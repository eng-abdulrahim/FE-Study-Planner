import { PlannerProvider } from "../state/PlannerContext";
import { SyncProvider } from "../state/SyncContext";
import { ThemeProvider } from "../state/ThemeProvider";
import { AppShell } from "../components/layout/AppShell";

export default function App() {
  return (
    <ThemeProvider>
      <PlannerProvider>
        <SyncProvider>
          <AppShell />
        </SyncProvider>
      </PlannerProvider>
    </ThemeProvider>
  );
}
