'use client';
import { createContext, useContext } from 'react';
export const ProfileContext=createContext({displayName:'My',email:'',openProfile:()=>{},signOut:async()=>{}});
export const useProfile=()=>useContext(ProfileContext);
