import { simulate } from "./simulation";
import { runSensitivity } from "./sensitivity";
self.onmessage = (event) => {
  try {
    self.postMessage({
      id: event.data.id,
      result:
        event.data.kind === "sensitivity"
          ? runSensitivity(event.data.inputs, event.data.dimension)
          : simulate(event.data.inputs),
    });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      error: error instanceof Error ? error.message : "Simulation failed",
    });
  }
};
