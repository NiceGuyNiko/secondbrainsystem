'use client';
import { createContext, useContext } from 'react';
export const ProfileContext=createContext({displayName:'My',email:'',userId:'',openProfile:()=>{},signOut:async()=>{}});
export const useProfile=()=>useContext(ProfileContext);
