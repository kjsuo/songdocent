import { useEffect, useRef, useState } from "react";
import {
  SETUP_GUIDES,
  type SetupCopy,
  type SetupGuideId,
} from "./setupContent";
import {
  officialSetupDestinationUrl,
  openSetupGuideDestination,
  type OfficialSetupDestinationId,
} from "./guideLinks";

export function SetupGuide({
  guideId,
  copy,
}: {
  guideId: SetupGuideId;
  copy: SetupCopy;
}) {
  const metadata = SETUP_GUIDES[guideId];
  const guide = copy.guides[guideId];
  const operationRef = useRef(0);
  const [openingDestinationId, setOpeningDestinationId] =
    useState<OfficialSetupDestinationId | null>(null);
  const [openFailed, setOpenFailed] = useState(false);

  useEffect(() => {
    operationRef.current += 1;
    setOpeningDestinationId(null);
    setOpenFailed(false);

    return () => {
      operationRef.current += 1;
    };
  }, [guideId]);

  const handleOpen = async (destinationId: OfficialSetupDestinationId) => {
    const operationId = operationRef.current + 1;
    operationRef.current = operationId;
    setOpeningDestinationId(destinationId);
    setOpenFailed(false);

    const result = await openSetupGuideDestination(guideId, destinationId);
    if (operationRef.current !== operationId) return;

    setOpeningDestinationId(null);
    setOpenFailed(result !== "opened");
  };

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
      <h2 className="text-lg font-semibold text-white">{guide.title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/65">{guide.body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {metadata.destinationIds.map((destinationId) => {
          const url = officialSetupDestinationUrl(destinationId);
          return (
            <button
              key={destinationId}
              type="button"
              aria-label={`${copy.guideLinks.openLabel}: ${url}`}
              disabled={openingDestinationId !== null}
              onClick={() => void handleOpen(destinationId)}
              title={url}
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/75 transition-colors hover:border-white/30 hover:text-white disabled:cursor-wait disabled:opacity-50"
            >
              {url}
            </button>
          );
        })}
      </div>
      {openFailed ? (
        <p role="status" aria-live="polite" className="mt-3 text-sm text-amber-300">
          {copy.guideLinks.openFailed}
        </p>
      ) : null}
      <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-6 text-white/75">
        {guide.steps.map((instruction) => (
          <li key={instruction}>{instruction}</li>
        ))}
      </ol>
    </section>
  );
}
