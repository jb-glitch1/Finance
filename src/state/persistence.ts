// Local persistence for scenarios. Everything stays in the browser
// (localStorage) — nothing is sent to a server. Scenarios can also be exported
// to / imported from JSON files for backup or sharing.

import type { Scenario } from "../engine/types";

const KEY = "mc-finance-scenarios-v1";

export interface SavedScenarios {
  [name: string]: Scenario;
}

export function loadAll(): SavedScenarios {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedScenarios) : {};
  } catch {
    return {};
  }
}

export function saveScenario(scenario: Scenario): void {
  const all = loadAll();
  all[scenario.name] = scenario;
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteScenario(name: string): void {
  const all = loadAll();
  delete all[name];
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function exportScenarioJson(scenario: Scenario): void {
  const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${scenario.name.replace(/\s+/g, "-").toLowerCase()}.scenario.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importScenarioJson(file: File): Promise<Scenario> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)) as Scenario);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
