export const useCleaner = () => {
  let cleanedUp = false;
  const cleanups = [];

  const cleaner = {
    addCleanup(fn) {
      cleanups.push(fn);

      if (cleanedUp) {
        setInterval(() => cleaner.cleanUp(), 0);
      }
      return !cleanedUp;
    },

    cleanUp() {
      while (cleanups.length > 0) {
        try {
          cleanups.pop()();
        } catch (e) {
          console.warn("Error during a clean up", e);
        }
      }
      cleanedUp = true;
    },
  };

  return cleaner;
};
