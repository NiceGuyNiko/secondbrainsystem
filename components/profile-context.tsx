'use client';
import { createContext, useContext } from 'react';
export const ProfileContext=createContext({displayName:'My'});
export const useProfile=()=>useContext(ProfileContext);
