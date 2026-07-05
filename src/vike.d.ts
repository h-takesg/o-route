declare global {
  namespace Vike {
    interface PageContext {
      Page: () => JSX.Element;
    }
  }
}

export {};
