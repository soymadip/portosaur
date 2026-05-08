import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
} from "react";

const PreviewContext = createContext(null);
const DEFAULT_SIZE = { width: 720, height: 400 };
const DEFAULT_DOCK_PERCENTAGE = 0.42;

export const PreviewMode = {
  POPUP: "popup",
  DOCK: "dock",
  PIP: "pip",
};

function getInitialState() {
  if (typeof window === "undefined") {
    return {
      isOpen: false,
      mode: "popup",
      dockWidth: 420,
      peekHeight: 400,
      sources: [],
      activeIndex: 0,
      baseSlug: null,
      modeSwitch: true,
      floatingState: { ...DEFAULT_SIZE, x: null, y: null },
    };
  }

  let defaultDockWidth = Math.floor(
    window.innerWidth * DEFAULT_DOCK_PERCENTAGE,
  );
  defaultDockWidth = Math.max(
    380,
    Math.min(defaultDockWidth, window.innerWidth * 0.8),
  );

  return {
    isOpen: false,
    mode: "popup",
    dockWidth: defaultDockWidth,
    peekHeight: window.innerHeight * 0.42,
    sources: [],
    activeIndex: 0,
    baseSlug: null,
    modeSwitch: true,
    floatingState: { ...DEFAULT_SIZE, x: null, y: null },
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "OPEN":
      return {
        ...state,
        isOpen: true,
        mode: action.mode || "popup",
        sources: action.sources,
        activeIndex: action.index ?? 0,
        baseSlug: action.baseSlug ?? null,
        modeSwitch: action.modeSwitch ?? true,
      };
    case "CLOSE":
      return {
        ...state,
        isOpen: false,
        mode: "popup",
        baseSlug: null,
        modeSwitch: true,
      };
    case "SET_MODE":
      return { ...state, mode: action.mode };
    case "SET_ACTIVE_INDEX":
      return { ...state, activeIndex: action.index };
    case "SET_DOCK_WIDTH":
      return { ...state, dockWidth: action.width };
    case "SET_PEEK_HEIGHT":
      return { ...state, peekHeight: action.height };
    case "SET_FLOATING_STATE":
      return {
        ...state,
        floatingState: { ...state.floatingState, ...action.state },
      };
    case "TOGGLE_MODE": {
      let nextMode = "popup";
      if (state.mode === "popup") nextMode = "dock";
      else if (state.mode === "dock") nextMode = "pip";
      else if (state.mode === "pip") nextMode = "dock";
      return { ...state, mode: nextMode };
    }
    default:
      return state;
  }
}

export function PreviewProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);

  const openPreview = useCallback(
    (
      sources,
      index = 0,
      hashId = null,
      mode = "popup",
      baseSlug = null,
      modeSwitch = true,
    ) => {
      if (hashId && typeof window !== "undefined") {
        window.history.replaceState(null, "", "#" + hashId);
      }
      dispatch({ type: "OPEN", sources, index, mode, baseSlug, modeSwitch });
    },
    [],
  );

  const closePreview = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
    dispatch({ type: "CLOSE" });
  }, []);

  const setMode = useCallback(
    (mode) => dispatch({ type: "SET_MODE", mode }),
    [],
  );
  const setActiveIndex = useCallback(
    (index) => dispatch({ type: "SET_ACTIVE_INDEX", index }),
    [],
  );
  const setDockWidth = useCallback(
    (width) => dispatch({ type: "SET_DOCK_WIDTH", width }),
    [],
  );
  const setPeekHeight = useCallback(
    (height) => dispatch({ type: "SET_PEEK_HEIGHT", height }),
    [],
  );
  const setFloatingState = useCallback(
    (newState) => dispatch({ type: "SET_FLOATING_STATE", state: newState }),
    [],
  );
  const toggleMode = useCallback(() => dispatch({ type: "TOGGLE_MODE" }), []);

  return (
    <PreviewContext.Provider
      value={{
        ...state,
        openPreview,
        closePreview,
        setMode,
        setActiveIndex,
        setDockWidth,
        setPeekHeight,
        setFloatingState,
        toggleMode,
      }}
    >
      {children}
    </PreviewContext.Provider>
  );
}

const DEFAULT_CTX = {
  isOpen: false,
  mode: "popup",
  dockWidth: 420,
  peekHeight: 400,
  sources: [],
  activeIndex: 0,
  baseSlug: null,
  modeSwitch: true,
  floatingState: { x: null, y: null, width: 800, height: 600 },
  openPreview: () => {},
  closePreview: () => {},
  setMode: () => {},
  setActiveIndex: () => {},
  setDockWidth: () => {},
  setPeekHeight: () => {},
  setFloatingState: () => {},
  toggleMode: () => {},
};

export function usePreview() {
  return useContext(PreviewContext) ?? DEFAULT_CTX;
}
