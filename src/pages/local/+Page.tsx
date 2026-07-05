import { useEffect, useState } from "react";

export { Page };

function Page() {
  const [LocalCanvas, setLocalCanvas] = useState<
    typeof import("../../components/LocalCanvas").LocalCanvas | null
  >(null);

  useEffect(() => {
    import("../../components/LocalCanvas").then((mod) => {
      setLocalCanvas(() => mod.LocalCanvas);
    });
  }, []);

  if (LocalCanvas === null) return null;

  return <LocalCanvas />;
}
