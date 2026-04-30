import { LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";

interface Module {
  id: string;
  name: string;
  desc: string;
  required?: boolean;
}

interface ModuleConfigurationProps {
  appModules: Module[];
  activeModules: any[];
  handleModuleToggle: (moduleId: string, isRequired?: boolean) => void;
  t: (key: string) => string;
}

export function ModuleConfiguration({ appModules, activeModules, handleModuleToggle, t }: ModuleConfigurationProps) {
  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm p-0 overflow-hidden">
      <div className="p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <LayoutTemplate className="h-5 w-5 text-blue-600" /> {t('module_config')}
        </h2>
        <p className="text-xs text-slate-500 mt-1">{t('module_config_desc')}</p>
      </div>

      <div className="divide-y divide-slate-100">
        {appModules.map((mod) => {
          const isActive = activeModules.some(m => m.moduleId === mod.id);
          return (
            <div key={mod.id} className={cn("p-5 flex items-start gap-4 transition-colors", isActive ? "bg-white" : "bg-slate-50/50")}>
              <div className="pt-0.5">
                <button
                  onClick={() => handleModuleToggle(mod.id, mod.required)}
                  disabled={mod.required}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed",
                    isActive ? "bg-blue-600" : "bg-slate-300",
                    mod.required && "opacity-50"
                  )}
                >
                  <span className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    isActive ? "translate-x-4" : "translate-x-0"
                  )} />
                </button>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className={cn("text-sm font-bold", isActive ? "text-slate-900" : "text-slate-500")}>
                    {mod.name}
                    {mod.required && <span className="ml-2 text-[9px] uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold border border-slate-200">{t('module_required')}</span>}
                    {isActive && !mod.required && <span className="ml-2 text-[9px] uppercase tracking-wider bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold border border-blue-200">{t('module_active')}</span>}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">{mod.id}</span>
                </div>
                <p className={cn("text-xs mt-1 leading-relaxed max-w-lg", isActive ? "text-slate-600" : "text-slate-400")}>
                  {mod.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
