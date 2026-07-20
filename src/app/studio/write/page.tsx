import { Suspense } from "react";
import StoryBuilderForm from "./StoryBuilderForm";

export default function StoryBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-6 py-10 w-full text-sm text-grey">
          Loading the story builder…
        </div>
      }
    >
      <StoryBuilderForm />
    </Suspense>
  );
}
