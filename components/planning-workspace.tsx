"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  ArrowLeft,
  ExternalLink,
  Target,
  Layers3,
  Check,
  Archive,
  Search,
} from "lucide-react";
import {
  planningStore,
  recordCode,
  recordTitle,
  eventDescendants,
  chronology,
  measuredProgress,
  suggestedTurningPoint,
  canParent,
  type PlanningKind,
  type PlanningRecord,
  type PlanningData,
} from "@/lib/planning";
import { thoughtStore, type Thought } from "@/lib/thoughts";
export default function PlanningWorkspace({
  section,
  initialId,
  onOpenPage,
  onSchedule,
  onContext,
}: {
  section: "Goals" | "Workspaces";
  initialId?: string;
  onOpenPage: (id: string) => void;
  onSchedule: (task: { id: string; title: string; workingId?: string }) => void;
  onContext: (rows: { id: string; title: string }[]) => void;
}) {
  const [thoughts, setThoughts] = useState<Thought[]>([]),
    [records, setRecords] = useState<PlanningRecord[]>([]),
    [active, setActive] = useState(initialId || ""),
    [workspace, setWorkspace] = useState(""),
    [tab, setTab] = useState<PlanningKind>(
      section === "Goals" ? "goal" : "workspace",
    ),
    [mode, setMode] = useState<"list" | "matrix">("list"),
    [title, setTitle] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [ready, setReady] = useState(false),
    [existing, setExisting] = useState(""),
    [search, setSearch] = useState("");
  const [draft, setDraft] = useState<PlanningRecord | null>(null),
    [dirty, setDirty] = useState(false),
    [archive, setArchive] = useState(false),
    [matrixRoot, setMatrixRoot] = useState(""),
    [matrixEventFilter, setMatrixEventFilter] = useState(""),
    [matrixCharacterFilter, setMatrixCharacterFilter] = useState(""),
    [matrixLoaded, setMatrixLoaded] = useState(""),
    [character, setCharacter] = useState(""),
    [event, setEvent] = useState(""),
    [listLimit, setListLimit] = useState(100),
    [rowPage, setRowPage] = useState(0),
    [colPage, setColPage] = useState(0),
    [swapped, setSwapped] = useState(false),
    [turningOnly, setTurningOnly] = useState(false),
    [amount, setAmount] = useState(""),
    [note, setNote] = useState("");
  useEffect(() => {
    if (!workspace) return;
    try {
      const saved = JSON.parse(
        localStorage.getItem("aaa-perspective-view-" + workspace) || "{}",
      );
      setMatrixRoot(typeof saved.root === "string" ? saved.root : "");
      setSwapped(saved.swapped === true);
      setMatrixEventFilter(
        typeof saved.events === "string" ? saved.events : "",
      );
      setMatrixCharacterFilter(
        typeof saved.characters === "string" ? saved.characters : "",
      );
    } catch {}
    setMatrixLoaded(workspace);
  }, [workspace]);
  useEffect(() => {
    if (workspace && matrixLoaded === workspace)
      localStorage.setItem(
        "aaa-perspective-view-" + workspace,
        JSON.stringify({
          root: matrixRoot,
          swapped,
          events: matrixEventFilter,
          characters: matrixCharacterFilter,
        }),
      );
  }, [
    workspace,
    matrixLoaded,
    matrixRoot,
    swapped,
    matrixEventFilter,
    matrixCharacterFilter,
  ]);
  const load = useCallback(async () => {
    try {
      const d = await planningStore.load();
      setReady(true);
      setThoughts(d.thoughts);
      setRecords(d.records);
      setError("");
      onContext(
        d.records
          .filter(
            (r) =>
              r.kind === (section === "Goals" ? "goal" : "workspace") &&
              !d.thoughts.find((t) => t.id === r.thought_id)?.details
                .archived_at,
          )
          .map((r) => ({
            id: r.thought_id,
            title: recordTitle(r, d.thoughts),
          })),
      );
    } catch (e) {
      setError(
        e instanceof Error &&
          /planning_records|thought_details|schema cache/i.test(e.message)
          ? "Workspace setup is pending. The database update must be installed before you can save pages."
          : e instanceof Error
            ? e.message
            : "Unable to load workspace",
      );
    } finally {
      setLoading(false);
    }
  }, [section, onContext]);
  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    window.addEventListener("aaa-planning-change", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("aaa-planning-change", refresh);
    };
  }, [load]);
  useEffect(() => {
    if (initialId) {
      if (section === "Workspaces") {
        setWorkspace(initialId);
        setTab("event");
        setActive("");
      } else setActive(initialId);
      setDraft(null);
      setDirty(false);
    }
  }, [initialId, section]);
  useEffect(() => {
    if (!dirty) return;
    const leave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  const choose = (id: string) => {
    if (dirty && !window.confirm("Discard unsaved changes to this page?"))
      return;
    setDraft(null);
    setDirty(false);
    setActive(id);
  };
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  };
  const current = draft || records.find((r) => r.thought_id === active);
  const currentThought = thoughts.find((t) => t.id === active);
  const patch = (data: Partial<PlanningData>) => {
    if (current) {
      setDraft({ ...current, data: { ...current.data, ...data } });
      setDirty(true);
    }
  };
  const refs = (
    field: "project_id" | "goal_id" | "working_id",
    value: string,
  ) => {
    if (current) {
      setDraft({ ...current, [field]: value || null });
      setDirty(true);
    }
  };
  const alive = (r: PlanningRecord) =>
    !!thoughts.find((t) => t.id === r.thought_id) &&
    !!thoughts.find((t) => t.id === r.thought_id)?.details.archived_at ===
      archive;
  const candidates = (kind: PlanningKind) =>
    records.filter(
      (r) =>
        r.kind === kind &&
        !thoughts.find((t) => t.id === r.thought_id)?.details.archived_at &&
        (kind === "workspace" ||
          kind === "goal" ||
          !workspace ||
          r.workspace_id === workspace),
    );
  const getTitle = (r: PlanningRecord) => recordTitle(r, thoughts);
  const events = candidates("event").sort(chronology),
    characters = candidates("character");
  const scoped = records
    .filter(
      (r) =>
        r.kind === tab &&
        alive(r) &&
        (!workspace || tab === "workspace" || r.workspace_id === workspace) &&
        getTitle(r).toLowerCase().includes(search.toLowerCase()),
    )
    .sort(chronology);
  const selectWorkspace = (id: string) => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setWorkspace(id);
    choose("");
    setTab("event");
    setMatrixRoot("");
    setRowPage(0);
    setColPage(0);
  };
  const create = async (kind = tab, ev = event, ch = character) => {
    if (kind === "perspective" && (!ev || !ch))
      throw new Error("Choose an event and a character.");
    if (kind !== "perspective" && !title.trim() && !existing)
      throw new Error("Enter a title.");
    const id = await planningStore.create(
      kind === "perspective"
        ? "Perspective"
        : title.trim() ||
            thoughts.find((t) => t.id === existing)?.title ||
            "Untitled",
      kind,
      {
        workspace_id: workspace || null,
        event_id: kind === "perspective" ? ev : null,
        character_id: kind === "perspective" ? ch : null,
      },
      { status: "idea", ...(kind === "goal" ? { goalType: "milestone" } : {}) },
      kind === "perspective" ? undefined : existing || undefined,
    );
    setTitle("");
    setExisting("");
    choose(id);
  };
  const save = async () => {
    if (!current) return;
    let r = current;
    if (
      current.kind === "perspective" &&
      (!current.data.turning || current.data.turning === "ordinary") &&
      suggestedTurningPoint(current.data)
    )
      r = { ...current, data: { ...current.data, turning: "suggested" } };
    await planningStore.save(r);
    setDraft(null);
    setDirty(false);
  };
  const rootIds = matrixRoot ? eventDescendants(thoughts, matrixRoot) : null;
  const matrixEvents = events.filter(
    (r) =>
      (!rootIds || rootIds.has(r.thought_id)) &&
      getTitle(r).toLowerCase().includes(matrixEventFilter.toLowerCase()),
  );
  const matrixChars = characters.filter((r) =>
    getTitle(r).toLowerCase().includes(matrixCharacterFilter.toLowerCase()),
  );
  const rows = swapped ? matrixChars : matrixEvents,
    cols = swapped ? matrixEvents : matrixChars;
  const axisRows = rows.slice(rowPage * 15, rowPage * 15 + 15),
    axisCols = cols.slice(colPage * 8, colPage * 8 + 8);
  return (
    <section className="aaa-planning">
      <div className="aaa-planning-head">
        <div>
          <p className="aaa-eyebrow">
            {section === "Goals"
              ? "Direction into action"
              : "Knowledge into work"}
          </p>
          <h1>
            {section === "Goals"
              ? "Goals & projects"
              : workspace
                ? records.find((r) => r.thought_id === workspace)
                  ? getTitle(records.find((r) => r.thought_id === workspace)!)
                  : "Workspace"
                : "Your workspaces"}
          </h1>
          <p className="calendar-subtle">
            {section === "Goals"
              ? "Track meaningful outcomes and measured progress."
              : "Events, characters and perspectives share one connected world."}
          </p>
        </div>
        {workspace && (
          <button
            onClick={() => {
              setWorkspace("");
              setTab("workspace");
              choose("");
            }}
          >
            <ArrowLeft size={16} />
            All workspaces
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="thought-error">
          {error}
          <button onClick={() => void load()}>Retry</button>
        </div>
      )}
      {loading && <p role="status">Loading your workspace…</p>}
      <div className="aaa-planning-tools">
        <div className="aaa-options">
          {(section === "Goals"
            ? ["goal", "project", "task"]
            : workspace
              ? [
                  "event",
                  "character",
                  "perspective",
                  "project",
                  "scene",
                  "task",
                ]
              : ["workspace"]
          ).map((k) => (
            <button
              key={k}
              aria-pressed={tab === k}
              onClick={() => {
                setTab(k as PlanningKind);
                choose("");
                setMode("list");
              }}
            >
              {k.charAt(0).toUpperCase() + k.slice(1)}s
            </button>
          ))}
        </div>
        <label className="aaa-search">
          <Search size={16} />
          <input
            aria-label="Search working records"
            placeholder="Search this view"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button aria-pressed={archive} onClick={() => setArchive(!archive)}>
          <Archive size={16} />
          {archive ? "Archived" : "Active"}
        </button>
      </div>
      {workspace && (
        <div className="aaa-options">
          <button
            aria-pressed={mode === "list"}
            onClick={() => setMode("list")}
          >
            Pages
          </button>
          <button
            aria-pressed={mode === "matrix"}
            onClick={() => {
              setMode("matrix");
              choose("");
            }}
          >
            Perspective Matrix
          </button>
        </div>
      )}
      {mode === "matrix" ? (
        <>
          <div className="aaa-matrix-controls">
            <label>
              Filter events
              <input
                value={matrixEventFilter}
                onChange={(e) => {
                  setMatrixEventFilter(e.target.value);
                  setRowPage(0);
                  setColPage(0);
                }}
              />
            </label>
            <label>
              Filter characters
              <input
                value={matrixCharacterFilter}
                onChange={(e) => {
                  setMatrixCharacterFilter(e.target.value);
                  setRowPage(0);
                  setColPage(0);
                }}
              />
            </label>
            <label>
              Event and descendants
              <select
                value={matrixRoot}
                onChange={(e) => {
                  setMatrixRoot(e.target.value);
                  setRowPage(0);
                  setColPage(0);
                }}
              >
                <option value="">All events</option>
                {events.map((r) => (
                  <option key={r.thought_id} value={r.thought_id}>
                    {getTitle(r)}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                setSwapped(!swapped);
                setRowPage(0);
                setColPage(0);
              }}
            >
              Swap axes
            </button>
            <p className="calendar-muted">
              Empty cells have no perspective yet. Click to create only a
              relevant pairing.
            </p>
          </div>
          <div className="aaa-matrix-scroll">
            <table className="aaa-matrix">
              <thead>
                <tr>
                  <th>{swapped ? "Character / Event" : "Event / Character"}</th>
                  {axisCols.map((c) => (
                    <th key={c.thought_id}>
                      <button onClick={() => choose(c.thought_id)}>
                        {getTitle(c)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {axisRows.map((row) => (
                  <tr key={row.thought_id}>
                    <th>
                      <button onClick={() => choose(row.thought_id)}>
                        {recordCode(row)} · {getTitle(row)}
                      </button>
                    </th>
                    {axisCols.map((col) => {
                      const ev = swapped ? col : row,
                        ch = swapped ? row : col;
                      const p = records.find(
                        (r) =>
                          r.kind === "perspective" &&
                          r.event_id === ev.thought_id &&
                          r.character_id === ch.thought_id &&
                          !thoughts.find((t) => t.id === r.thought_id)?.details
                            .archived_at,
                      );
                      return (
                        <td key={col.thought_id}>
                          <button
                            disabled={busy}
                            onClick={() =>
                              p
                                ? choose(p.thought_id)
                                : void run(async () =>
                                    create(
                                      "perspective",
                                      ev.thought_id,
                                      ch.thought_id,
                                    ),
                                  )
                            }
                          >
                            {p ? (
                              <>
                                <strong>{recordCode(p)}</strong>
                                <span>
                                  {p.data.summary || "Open perspective"}
                                </span>
                              </>
                            ) : (
                              <span className="calendar-muted">
                                + Perspective
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="aaa-options">
            <button
              disabled={!rowPage}
              onClick={() => setRowPage((n) => n - 1)}
            >
              Previous rows
            </button>
            <span>
              Rows {rowPage * 15 + 1}–{Math.min(rows.length, rowPage * 15 + 15)}{" "}
              of {rows.length}
            </span>
            <button
              disabled={(rowPage + 1) * 15 >= rows.length}
              onClick={() => setRowPage((n) => n + 1)}
            >
              Next rows
            </button>
            <button
              disabled={!colPage}
              onClick={() => setColPage((n) => n - 1)}
            >
              Previous columns
            </button>
            <button
              disabled={(colPage + 1) * 8 >= cols.length}
              onClick={() => setColPage((n) => n + 1)}
            >
              Next columns
            </button>
          </div>
        </>
      ) : (
        <div className="aaa-planning-columns">
          <div className="aaa-record-list">
            <form
              className="aaa-create"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => create());
              }}
            >
              {tab === "perspective" ? (
                <>
                  <label>
                    Event
                    <select
                      required
                      value={event}
                      onChange={(e) => setEvent(e.target.value)}
                    >
                      <option value="">Choose event</option>
                      {events.map((r) => (
                        <option key={r.thought_id} value={r.thought_id}>
                          {getTitle(r)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Character
                    <select
                      required
                      value={character}
                      onChange={(e) => setCharacter(e.target.value)}
                    >
                      <option value="">Choose character</option>
                      {characters.map((r) => (
                        <option key={r.thought_id} value={r.thought_id}>
                          {getTitle(r)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <input
                  required={!existing}
                  aria-label={`New ${tab} title`}
                  placeholder={`New ${tab}…`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              )}
              {tab !== "perspective" && (
                <select
                  aria-label="Use an existing thought as this record"
                  value={existing}
                  onChange={(e) => setExisting(e.target.value)}
                >
                  <option value="">Or use an existing thought…</option>
                  {thoughts
                    .filter(
                      (t) =>
                        !t.details.archived_at &&
                        !records.some((r) => r.thought_id === t.id),
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title || "Untitled"}
                      </option>
                    ))}
                </select>
              )}
              <button
                disabled={busy || loading || !ready}
                className="calendar-primary"
              >
                <Plus size={16} />
                Create {tab}
              </button>
            </form>
            {!scoped.length && !loading && (
              <div className="aaa-empty">
                {section === "Goals" ? (
                  <Target size={28} />
                ) : (
                  <Layers3 size={28} />
                )}
                <p>No {tab}s here yet.</p>
                <small>A title is enough to get started.</small>
              </div>
            )}
            {scoped.slice(0, listLimit).map((r) => (
              <button
                className={`aaa-record-card ${active === r.thought_id ? "selected" : ""}`}
                key={r.thought_id}
                onClick={() =>
                  r.kind === "workspace"
                    ? selectWorkspace(r.thought_id)
                    : choose(r.thought_id)
                }
              >
                <small>
                  {recordCode(r)} · {r.data.status || "idea"}
                </small>
                <strong>{getTitle(r)}</strong>
                <span>{r.data.summary || ""}</span>
                {r.kind === "goal" && (
                  <small>
                    {r.data.goalType === "outcome"
                      ? `${measuredProgress(r, records)} / ${r.data.target || "—"} ${r.data.unit || ""}`
                      : r.data.done
                        ? "Milestone complete"
                        : "Milestone open"}
                  </small>
                )}
              </button>
            ))}
            {scoped.length > listLimit && (
              <button onClick={() => setListLimit((n) => n + 100)}>
                Load more pages ({scoped.length - listLimit} remaining)
              </button>
            )}
          </div>
          <div className="aaa-record-detail">
            {!current && (
              <div className="aaa-empty">
                <h2>Start with one sentence.</h2>
                <p>
                  Select a page to develop it, connect it and put the work on
                  your calendar.
                </p>
              </div>
            )}
            {current && renderDetail()}
          </div>
        </div>
      )}
      {mode === "matrix" && current && (
        <div className="aaa-record-detail">{renderDetail()}</div>
      )}
    </section>
  );
  function renderDetail() {
    if (!current) return null;
    const r = current;
    return (
      <>
        <div className="aaa-detail-heading">
          <span className="aaa-eyebrow">
            {recordCode(r)} · {r.kind}
          </span>
          <h2>{getTitle(r)}</h2>
          <div className="aaa-options">
            <button
              disabled={busy || !dirty}
              className="calendar-primary"
              onClick={() => void run(save)}
            >
              Save changes
            </button>
            <button
              onClick={() => {
                if (dirty && !window.confirm("Discard unsaved changes?"))
                  return;
                onOpenPage(r.thought_id);
              }}
            >
              <ExternalLink size={15} />
              Open full page
            </button>
            <span role="status">{dirty ? "Unsaved changes" : "Saved"}</span>
          </div>
        </div>
        <label>
          One-sentence summary
          <textarea
            rows={2}
            value={r.data.summary || ""}
            onChange={(e) => patch({ summary: e.target.value })}
          />
        </label>
        <label>
          Knowledge status
          <select
            value={r.data.status || "idea"}
            onChange={(e) =>
              patch({ status: e.target.value as PlanningData["status"] })
            }
          >
            {["idea", "developing", "canon", "superseded"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {r.kind === "event" && (
          <>
            <label>
              World chronological order
              <input
                type="number"
                value={r.data.chronology ?? 0}
                onChange={(e) => patch({ chronology: Number(e.target.value) })}
              />
            </label>
            <label>
              Parent event
              <select
                value={currentThought?.details.parent_id || ""}
                disabled={busy || dirty}
                onChange={(e) =>
                  void run(async () => {
                    if (currentThought)
                      await thoughtStore.save({
                        ...currentThought,
                        details: {
                          ...currentThought.details,
                          parent_id: e.target.value || null,
                        },
                      });
                  })
                }
              >
                <option value="">No parent</option>
                {events
                  .filter(
                    (e) =>
                      e.thought_id !== r.thought_id &&
                      canParent(thoughts, r.thought_id, e.thought_id),
                  )
                  .map((e) => (
                    <option key={e.thought_id} value={e.thought_id}>
                      {getTitle(e)}
                    </option>
                  ))}
              </select>
            </label>
            <button
              onClick={() => {
                setMatrixRoot(r.thought_id);
                setMode("matrix");
                choose("");
              }}
            >
              View this event and descendants in matrix
            </button>
          </>
        )}
        {r.kind === "character" && (
          <>
            <h3>Life timeline</h3>
            <label className="aaa-check">
              <input
                type="checkbox"
                checked={turningOnly}
                onChange={(e) => setTurningOnly(e.target.checked)}
              />
              Confirmed turning points only
            </label>
            {records
              .filter(
                (p) =>
                  p.kind === "perspective" &&
                  p.character_id === r.thought_id &&
                  !thoughts.find((t) => t.id === p.thought_id)?.details
                    .archived_at &&
                  (!turningOnly || p.data.turning === "confirmed"),
              )
              .sort((a, b) =>
                chronology(
                  records.find((e) => e.thought_id === a.event_id)!,
                  records.find((e) => e.thought_id === b.event_id)!,
                ),
              )
              .map((p) => (
                <button
                  className="aaa-timeline-item"
                  key={p.thought_id}
                  onClick={() => choose(p.thought_id)}
                >
                  <small>
                    {recordCode(p)}
                    {p.data.turning === "confirmed" ? " · Turning point" : ""}
                  </small>
                  <strong>{getTitle(p)}</strong>
                  <span>{p.data.summary}</span>
                </button>
              ))}
          </>
        )}
        {r.kind === "perspective" && (
          <>
            <div className="aaa-options">
              {[r.event_id, r.character_id].map((id) => (
                <button key={id} onClick={() => choose(id!)}>
                  {thoughts.find((t) => t.id === id)?.title}
                </button>
              ))}
            </div>
            <p className="calendar-muted text-xs">
              This page records knowledge at this moment. Later revelations
              belong to later events.
            </p>
            {(
              [
                "witnessed",
                "told",
                "inferred",
                "before",
                "after",
                "remembered",
                "motivation",
              ] as const
            ).map((field) => (
              <label key={field}>
                {
                  {
                    witnessed: "What they witnessed",
                    told: "What they were told",
                    inferred: "What they inferred",
                    before: "Knowledge / feelings before",
                    after: "Knowledge / feelings after",
                    remembered: "Remembered / forgotten",
                    motivation: "Motivation / goals",
                  }[field]
                }
                <textarea
                  rows={2}
                  value={r.data[field] || ""}
                  onChange={(e) => patch({ [field]: e.target.value })}
                />
              </label>
            ))}
            <label>
              Turning point
              <select
                value={r.data.turning || "ordinary"}
                onChange={(e) =>
                  patch({ turning: e.target.value as PlanningData["turning"] })
                }
              >
                {["ordinary", "suggested", "confirmed", "dismissed"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </label>
            {r.data.turning === "suggested" && (
              <p className="calendar-accent">
                A change was detected. Confirm or dismiss its significance as
                the author.
              </p>
            )}
          </>
        )}
        {r.kind === "goal" && (
          <>
            <label>
              Success criterion
              <select
                value={r.data.goalType || "milestone"}
                onChange={(e) =>
                  patch({ goalType: e.target.value as "outcome" | "milestone" })
                }
              >
                <option value="milestone">Completion milestone</option>
                <option value="outcome">Measured outcome</option>
              </select>
            </label>
            {r.data.goalType === "outcome" ? (
              <>
                <label>
                  Target
                  <input
                    type="number"
                    min="0.01"
                    value={r.data.target ?? ""}
                    onChange={(e) => {
                      const d = { ...r.data };
                      if (e.target.value) d.target = Number(e.target.value);
                      else delete d.target;
                      setDraft({ ...r, data: d });
                      setDirty(true);
                    }}
                  />
                </label>
                <label>
                  Unit
                  <input
                    value={r.data.unit || ""}
                    placeholder="words, dollars, lb…"
                    onChange={(e) => patch({ unit: e.target.value })}
                  />
                </label>
                <p className="aaa-progress-number">
                  {measuredProgress(r, records)} / {r.data.target || "—"}{" "}
                  {r.data.unit}
                </p>
                <progress
                  max={r.data.target || 1}
                  value={measuredProgress(r, records)}
                />
                <form
                  className="aaa-measure"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      if (!Number.isFinite(Number(amount)) || !amount)
                        throw new Error("Enter a measurement.");
                      await planningStore.create(
                        note || "Progress measurement",
                        "activity",
                        { goal_id: r.thought_id },
                        {
                          amount: Number(amount),
                          summary: note,
                          recordedAt: new Date().toISOString(),
                        },
                      );
                      setAmount("");
                      setNote("");
                    });
                  }}
                >
                  <label>
                    Actual progress (add or correct)
                    <input
                      type="number"
                      step="any"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <label>
                    Session / note
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <button disabled={busy} className="calendar-primary">
                    Record measurement
                  </button>
                </form>
                {records
                  .filter(
                    (a) => a.kind === "activity" && a.goal_id === r.thought_id,
                  )
                  .map((a) => (
                    <p className="calendar-subtle text-xs" key={a.thought_id}>
                      {String(a.data.recordedAt || "").slice(0, 10)} ·{" "}
                      {a.data.amount} {r.data.unit} · {a.data.summary}
                    </p>
                  ))}
              </>
            ) : (
              <label className="aaa-check">
                <input
                  type="checkbox"
                  checked={!!r.data.done}
                  onChange={(e) => patch({ done: e.target.checked })}
                />
                Milestone completed
              </label>
            )}
            <label>
              Deadline
              <input
                type="date"
                value={r.data.deadline || ""}
                onChange={(e) => patch({ deadline: e.target.value })}
              />
            </label>
          </>
        )}
        {["project", "task", "scene"].includes(r.kind) && (
          <>
            <label>
              Related goal
              <select
                value={r.goal_id || ""}
                onChange={(e) => refs("goal_id", e.target.value)}
              >
                <option value="">None</option>
                {candidates("goal").map((p) => (
                  <option key={p.thought_id} value={p.thought_id}>
                    {getTitle(p)}
                  </option>
                ))}
              </select>
            </label>
            {r.kind !== "project" && (
              <label>
                Project
                <select
                  value={r.project_id || ""}
                  onChange={(e) => refs("project_id", e.target.value)}
                >
                  <option value="">None</option>
                  {candidates("project").map((p) => (
                    <option key={p.thought_id} value={p.thought_id}>
                      {getTitle(p)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Working page / resource
              <select
                value={r.working_id || ""}
                onChange={(e) => refs("working_id", e.target.value)}
              >
                <option value="">None</option>
                {thoughts
                  .filter(
                    (t) => !t.details.archived_at && t.id !== r.thought_id,
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title || "Untitled"}
                    </option>
                  ))}
              </select>
            </label>
            {r.working_id && (
              <button onClick={() => onOpenPage(r.working_id!)}>
                Open linked working page
              </button>
            )}
          </>
        )}
        {r.kind === "project" && (
          <>
            <details>
              <summary>First thoughts</summary>
              <textarea
                rows={4}
                value={r.data.firstThoughts || ""}
                onChange={(e) => patch({ firstThoughts: e.target.value })}
              />
            </details>
            <h3>Project work</h3>
            {records
              .filter((p) => p.project_id === r.thought_id)
              .map((p) => (
                <button
                  className="aaa-timeline-item"
                  key={p.thought_id}
                  onClick={() => choose(p.thought_id)}
                >
                  {recordCode(p)} · {getTitle(p)}
                </button>
              ))}
          </>
        )}
        {r.kind === "scene" && (
          <>
            <label>
              Manuscript / reveal order
              <input
                type="number"
                value={r.data.sceneOrder ?? 0}
                onChange={(e) => patch({ sceneOrder: Number(e.target.value) })}
              />
            </label>
            <label>
              Scene status
              <select
                value={r.data.sceneStatus || "planned"}
                onChange={(e) =>
                  patch({
                    sceneStatus: e.target.value as PlanningData["sceneStatus"],
                  })
                }
              >
                {["planned", "outlined", "drafted", "revised"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <p className="calendar-muted">
              Link source perspectives and resources through Connections in the
              full page.
            </p>
          </>
        )}
        {r.kind === "task" && (
          <>
            <label className="aaa-check">
              <input
                type="checkbox"
                checked={!!r.data.done}
                onChange={(e) => patch({ done: e.target.checked })}
              />
              <Check size={14} />
              Task completed
            </label>
            <button
              disabled={dirty}
              className="calendar-primary"
              onClick={() =>
                onSchedule({
                  id: r.thought_id,
                  title: getTitle(r),
                  workingId: r.working_id || undefined,
                })
              }
            >
              Schedule in a calendar block
            </button>
          </>
        )}
        {["event", "character", "perspective", "scene"].includes(r.kind) && (
          <button
            disabled={dirty || busy}
            onClick={() =>
              void run(async () => {
                const id = await planningStore.create(
                  "Develop " + getTitle(r),
                  "task",
                  {
                    workspace_id: r.workspace_id,
                    working_id: r.thought_id,
                    project_id: r.project_id,
                  },
                );
                choose(id);
                setTab("task");
              })
            }
          >
            + Create linked development task
          </button>
        )}
        {currentThought && (
          <button
            disabled={busy || dirty}
            onClick={() =>
              void run(async () => {
                await thoughtStore.save({
                  ...currentThought,
                  details: {
                    ...currentThought.details,
                    archived_at: currentThought.details.archived_at
                      ? null
                      : new Date().toISOString(),
                  },
                });
                choose("");
              })
            }
          >
            {currentThought.details.archived_at
              ? "Restore page"
              : "Archive page"}
          </button>
        )}
      </>
    );
  }
}
