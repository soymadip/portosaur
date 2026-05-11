import { createContext, useContext, useReducer, useCallback } from "react";

const PreviewContext = createContext(null);

const DEFAULT_SIZE = { width: 720, height: 500 };
const DEFAULT_DOCK_PERCENTAGE = 0.42; // 42% of viewport width

function getInitialState() {
  if (typeof window === "undefined") {
    return {
      isOpen: false,
      isDocked: false,
      dockWidth: 420,
      sources: [],
      activeIndex: 0,
      floatingState: {
        width: DEFAULT_SIZE.width,
        height: DEFAULT_SIZE.height,
        x: null,
        y: null,
      },
    };
  }

  let defaultDockWidth = 420;
  if (typeof window !== "undefined") {
    // Configurable % of viewport, clamped between 380px and 80% of screen
    defaultDockWidth = Math.floor(window.innerWidth * DEFAULT_DOCK_PERCENTAGE);
    defaultDockWidth = Math.max(
      380,
      Math.min(defaultDockWidth, window.innerWidth * 0.8),
    );
  }

  return {
    isOpen: false,
    isDocked: false,
    dockWidth: defaultDockWidth,
    sources: [],
    activeIndex: 0,
    floatingState: {
      width: DEFAULT_SIZE.width,
      height: DEFAULT_SIZE.height,
      x: null,
      y: null,
    },
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "OPEN":
      return {
        ...state,
        isOpen: true,
        sources: action.sources,
        activeIndex: action.index ?? 0,
      };
    case "CLOSE":
      return { ...state, isOpen: false, isDocked: false };
    case "SET_DOCKED":
      return { ...state, isDocked: action.value };
    case "SET_ACTIVE_INDEX":
      return { ...state, activeIndex: action.index };
    case "SET_DOCK_WIDTH":
      return { ...state, dockWidth: action.width };
    case "SET_FLOATING_STATE":
      return {
        ...state,
        floatingState: { ...state.floatingState, ...action.state },
      };
    default:
      return state;
  }
}

export function PreviewProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);

  const openPreview = useCallback((sources, index = 0, hashId = null) => {
    if (hashId && typeof window !== "undefined") {
      window.history.replaceState(null, null, "#" + hashId);
    }
    dispatch({ type: "OPEN", sources, index });
  }, []);

  const closePreview = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        null,
        window.location.pathname + window.location.search,
      );
    }
    dispatch({ type: "CLOSE" });
  }, []);

  const setDocked = useCallback((val) => {
    dispatch({ type: "SET_DOCKED", value: val });
  }, []);

  const setActiveIndex = useCallback((index) => {
    dispatch({ type: "SET_ACTIVE_INDEX", index });
  }, []);

  const setDockWidth = useCallback((width) => {
    dispatch({ type: "SET_DOCK_WIDTH", width });
  }, []);

  const setFloatingState = useCallback((newState) => {
    dispatch({ type: "SET_FLOATING_STATE", state: newState });
  }, []);

  return (
    <PreviewContext.Provider
      value={{
        ...state,
        openPreview,
        closePreview,
        setDocked,
        setActiveIndex,
        setDockWidth,
        setFloatingState,
      }}
    >
      {children}
    </PreviewContext.Provider>
  );
}

const DEFAULT_CTX = {
  isOpen: false,
  isDocked: false,
  dockWidth: 420,
  sources: [],
  activeIndex: 0,
  floatingState: { x: null, y: null, width: 800, height: 600 },
  openPreview: () => {},
  closePreview: () => {},
  setDocked: () => {},
  setActiveIndex: () => {},
  setDockWidth: () => {},
  setFloatingState: () => {},
};

export function usePreview() {
  return useContext(PreviewContext) ?? DEFAULT_CTX;
}
