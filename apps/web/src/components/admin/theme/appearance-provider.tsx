'use client';
import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {api} from '../../../lib/api';
export type AppearancePreset='REFERENCE_DEFAULT'|'MUTED'|'MEDIUM'|'CONCENTRATED'|'GLASS'|'CALM'|'FLAT';
export type AppearanceSettings={primaryColor:string;accentColor:string;colorIntensity:number;gradientEnabled:boolean;preset:AppearancePreset;fontScale:string;shadow:string;radius:string;glassOpacity:number;glassBlur:number;compactMode:boolean;sidebarCollapsed:boolean;sidebarBg:string;sidebarAccent:string;sidebarDensity:string;sidebarFont:string;tableDensity:string;showStatusBar:boolean;showActionBar:boolean};
export const REFERENCE_DEFAULT:AppearanceSettings={primaryColor:'#2563eb',accentColor:'#14b8a6',colorIntensity:70,gradientEnabled:true,preset:'REFERENCE_DEFAULT',fontScale:'medium',shadow:'medium',radius:'medium',glassOpacity:.72,glassBlur:14,compactMode:false,sidebarCollapsed:false,sidebarBg:'navy',sidebarAccent:'teal',sidebarDensity:'default',sidebarFont:'normal',tableDensity:'default',showStatusBar:true,showActionBar:true};
type Ctx={settings:AppearanceSettings;draftSettings:AppearanceSettings;loading:boolean;saving:boolean;updateDraft:(p:Partial<AppearanceSettings>)=>void;save:()=>Promise<void>;revert:()=>void;restoreDefaults:()=>void};
const C=createContext<Ctx|null>(null);
const normalize=(r:any):AppearanceSettings=>({...REFERENCE_DEFAULT,...r,gradientEnabled:r?.gradientEnabled!==false,showStatusBar:r?.showStatusBar!==false,showActionBar:r?.showActionBar!==false});
export function applyAppearance(s:AppearanceSettings){if(typeof document==='undefined')return;const r=document.documentElement;r.style.setProperty('--ats-primary',s.primaryColor);r.style.setProperty('--ats-accent',s.accentColor);r.style.setProperty('--ats-sidebar-gradient',s.gradientEnabled?'linear-gradient(135deg,#071a2f,'+s.accentColor+')':'#071a2f');r.style.setProperty('--ats-topbar-gradient',s.gradientEnabled?'linear-gradient(135deg,#dff6ff,'+s.primaryColor+')':'#dff6ff');r.style.setProperty('--ats-form-gradient',s.gradientEnabled?'linear-gradient(135deg,#e9f8ff,'+s.accentColor+')':'#e9f8ff');r.style.setProperty('--ats-font-scale',s.fontScale==='large'?'1.08':s.fontScale==='small'?'.94':'1');r.dataset.appearancePreset=s.preset;}
export function AppearanceProvider({children}:{children:React.ReactNode}){
const [settings,setSettings]=useState(REFERENCE_DEFAULT);const [draftSettings,setDraft]=useState(REFERENCE_DEFAULT);const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);
useEffect(()=>{let active=true;(async()=>{try{const s=normalize(await api.get<any>('/settings/appearance'));if(active){setSettings(s);setDraft(s);applyAppearance(s);}}catch{applyAppearance(REFERENCE_DEFAULT);}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[]);
useEffect(()=>{if(!loading)applyAppearance(draftSettings);},[draftSettings,loading]);
const updateDraft=(p:Partial<AppearanceSettings>)=>setDraft(x=>({...x,...p}));
const save=async()=>{setSaving(true);try{const s=normalize(await api.patch<any>('/settings/appearance',draftSettings));setSettings(s);setDraft(s);applyAppearance(s);}finally{setSaving(false);}};
const revert=()=>setDraft(settings);const restoreDefaults=()=>setDraft(REFERENCE_DEFAULT);
const value=useMemo(()=>({settings,draftSettings,loading,saving,updateDraft,save,revert,restoreDefaults}),[settings,draftSettings,loading,saving]);
return <C.Provider value={value}>{children}</C.Provider>;}
export function useAppearance(){const v=useContext(C);if(!v)throw new Error('useAppearance must be used inside AppearanceProvider');return v;}
