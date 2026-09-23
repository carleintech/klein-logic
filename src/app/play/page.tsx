import RegionsExperience from "@/components/game/RegionsExperience";
import KleinLogicShell from "@/components/logic/KleinLogicShell";

export default function PlayPage() {
  return (
    <KleinLogicShell context="Regions // Spatial Logic" backHref="/games" backLabel="Games">
      <section className="mx-auto max-w-3xl py-10 sm:py-14">
        <header className="mb-8 text-center">
          <p className="logic-kicker">Spatial challenge</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Regions</h1>
          <p className="mt-3 text-text-secondary">Divide the board into perfect regions.</p>
        </header>
        <RegionsExperience />
      </section>
    </KleinLogicShell>
  );
}
