import { createContext, useContext } from "react";

// The page breakpoint matters here: desktop canvases also use narrow columns.
export const SceneQualityContext = createContext({ mobile: false });
export const useSceneQuality = () => useContext(SceneQualityContext);
