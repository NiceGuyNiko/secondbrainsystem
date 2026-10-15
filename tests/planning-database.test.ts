import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const a = "00000000-0000-0000-0000-000000000001",
  b = "00000000-0000-0000-0000-000000000002";
test("canonical planning records, permanent sequence IDs, perspective uniqueness, measurements, RLS and rollback", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create table public.user_items(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id),title text not null,item_type text not null,content jsonb not null default '{}',created_at timestamptz default now(),updated_at timestamptz default now());alter table public.user_items enable row level security;create policy owner on public.user_items for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());grant select,insert,update,delete on public.user_items to authenticated;`,
  );

  for (const f of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`,
  );
  const create = async (
    kind: string,
    title: string,
    workspace: string | null = null,
    event: string | null = null,
    character: string | null = null,
    data = "{}",
    goal: string | null = null,
  ) => {
    const id = crypto.randomUUID();
    const result = await db.query<{ id: string }>(
      "select public.create_planning_record($1,$2,$3,$4,$5,$6,null,$7,null,$8) as id",
      [id, title, kind, workspace, event, character, goal, data],
    );
    return result.rows[0].id;
  };
  const ws = await create("workspace", "Nobody Special");
  const event = await create("event", "The Blackout", ws);
  const character = await create("character", "Michael", ws);
  const p1 = await create("perspective", "Ignored title", ws, event, character);
  const duplicate = await create(
    "perspective",
    "Also ignored",
    ws,
    event,
    character,
  );
  assert.equal(p1, duplicate);
  const otherEvent = await create("event", "Later revelation", ws);
  const p2 = await create(
    "perspective",
    "Perspective",
    ws,
    otherEvent,
    character,
  );
  const pRows = await db.query<{ thought_id: string; sequence_no: number }>(
    `select thought_id,sequence_no from planning_records where kind='perspective' order by sequence_no`,
  );
  assert.deepEqual(
    pRows.rows.map((r) => Number(r.sequence_no)),
    [1, 2],
  );
  await db.query(`update user_items set title='Renamed Michael' where id=$1`, [
    character,
  ]);
  assert.equal(
    (
      await db.query<{ title: string }>(
        "select title from user_items where id=$1",
        [p1],
      )
    ).rows[0].title,
    "Renamed Michael during The Blackout",
  );
  await db.query("select save_planning_record($1,1,$2,$3,null,null,null)", [
    p1,
    '{"summary":"What he knew then","before":"knows","after":"forgotten"}',
    ws,
  ]);
  await assert.rejects(
    db.query("select save_planning_record($1,1,$2,$3,null,null,null)", [
      p1,
      "{}",
      ws,
    ]),
  );
  await db.query("select save_planning_record($1,1,$2,$3,null,null,null)", [
    p2,
    '{"summary":"Learns a new truth"}',
    ws,
  ]);
  assert.equal(
    (
      await db.query<{ data: { summary: string } }>(
        "select data from planning_records where thought_id=$1",
        [p1],
      )
    ).rows[0].data.summary,
    "What he knew then",
  );
  await assert.rejects(
    db.query("update planning_records set sequence_no=99 where thought_id=$1", [
      p1,
    ]),
  );
  await assert.rejects(
    db.query("update planning_records set event_id=$1 where thought_id=$2", [
      otherEvent,
      p1,
    ]),
  );
  await assert.rejects(create("perspective", "Invalid", ws, character, event));
  const ws2 = await create("workspace", "Other world");
  await assert.rejects(create("perspective", "Invalid", ws2, event, character));
  const goal = await create(
    "goal",
    "Write 120000 words",
    null,
    null,
    null,
    '{"goalType":"outcome","target":120000,"unit":"words"}',
  );
  const task = await create(
    "task",
    "Draft a scene",
    ws,
    null,
    null,
    '{"done":false}',
    goal,
  );
  await db.query(
    `update planning_records set data='{"done":true}' where thought_id=$1`,
    [task],
  );
  assert.equal(
    (await db.query(`select * from planning_records where kind='activity'`))
      .rows.length,
    0,
  );
  await create(
    "activity",
    "Writing session",
    null,
    null,
    null,
    '{"amount":1500}',
    goal,
  );
  assert.equal(
    Number(
      (
        await db.query<{ sum: number }>(
          `select sum((data->>'amount')::numeric) as sum from planning_records where goal_id=$1 and kind='activity'`,
          [goal],
        )
      ).rows[0].sum,
    ),
    1500,
  );
  await assert.rejects(
    create("goal", "Bad target", null, null, null, '{"target":-1}'),
  );
  const existing = crypto.randomUUID();
  await db.query(`select create_thought($1,'An existing idea','{}')`, [
    existing,
  ]);
  await db.query(
    `select create_planning_record($1,'Do not replace title','character',$2)`,
    [existing, ws],
  );
  assert.equal(
    (
      await db.query<{ title: string }>(
        "select title from user_items where id=$1",
        [existing],
      )
    ).rows[0].title,
    "An existing idea",
  );
  await db.query(
    "update thought_details set archived_at=now() where thought_id=$1",
    [character],
  );
  assert.equal(
    (await db.query("select * from planning_records where thought_id=$1", [p1]))
      .rows.length,
    1,
  );
  const schedule = crypto.randomUUID();
  await db.query(
    `insert into user_items(id,title,item_type,content) values($1,'Session','block',$2)`,
    [
      schedule,
      JSON.stringify({
        date: "2026-10-15",
        endDate: "2026-10-15",
        start: "10:00",
        end: "11:00",
        tasks: [
          {
            id: 1,
            taskId: task,
            title: "Draft a scene",
            done: false,
            project: "",
          },
        ],
      }),
    ],
  );
  await assert.rejects(
    db.query(
      `insert into user_items(title,item_type,content) values('Invalid linked task','block',$1)`,
      [JSON.stringify({ tasks: [{ taskId: event }] })],
    ),
  );
  const countBefore = (await db.query("select * from user_items")).rows.length;
  await assert.rejects(create("event", "Orphan should roll back", character));
  assert.equal(
    (await db.query("select * from user_items")).rows.length,
    countBefore,
  );
  const taskVersion=(await db.query<{version:number}>("select version from planning_records where thought_id=$1",[task])).rows[0].version;
  await db.query('select set_planning_task_completion($1,false,$2)',[task,taskVersion]);
  await assert.rejects(db.query('select set_planning_task_completion($1,true,$2)',[task,taskVersion]));
  await db.query("update user_items set title='Unexpected retitle' where id=$1",[p1]);
  assert.equal((await db.query<{title:string}>('select title from user_items where id=$1',[p1])).rows[0].title,'Renamed Michael during The Blackout');
  await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
  assert.equal(
    (await db.query("select * from planning_records")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from planning_counters")).rows.length,
    0,
  );
  await assert.rejects(
    create("perspective", "Cross owner", ws, event, character),
  );
  await assert.rejects(
    create("task", "Cross working", null, null, null, "{}", goal),
  );
  assert.equal(
    (
      await db.query(
        "select * from user_items where title in ('Cross owner','Cross working')",
      )
    ).rows.length,
    0,
  );
  await db.exec("reset role;set role anon;");
  await assert.rejects(db.query("select * from planning_records"));
  await db.exec("reset role;");
  await db.exec(
    "begin;drop table planning_records cascade;drop table planning_counters;rollback;",
  );
  assert.ok((await db.query("select * from planning_records")).rows.length > 0);
  await db.close();
});
