import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import Circle_ from "@mui/icons-material/Circle";
import Contrast_ from "@mui/icons-material/Contrast";
import RadioButtonUnchecked_ from "@mui/icons-material/RadioButtonUnchecked";
import { LineOpacity } from "../types";

// https://github.com/mui/material-ui/issues/37375
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const Circle: typeof Circle_ = Circle_.default ?? Circle_;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const Contrast: typeof Contrast_ = Contrast_.default ?? Contrast_;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// prettier-ignore
const RadioButtonUnchecked: typeof RadioButtonUnchecked_ = RadioButtonUnchecked_.default ?? RadioButtonUnchecked_;

type Props = {
  lineOpacity: LineOpacity;
  setLineOpacity: (next: LineOpacity) => void;
};

function LineOpacityControl({ lineOpacity, setLineOpacity }: Props) {
  const handleOpacityChange = (event: React.MouseEvent<HTMLElement>, nextOpacity: LineOpacity) => {
    if (nextOpacity !== null) {
      setLineOpacity(nextOpacity);
    }
  };

  return (
    <ToggleButtonGroup
      orientation="vertical"
      value={lineOpacity}
      exclusive
      size="large"
      color="primary"
      sx={{
        background: "white",
        borderRadius: "4px",
        boxShadow: 20,
        margin: "1rem",
      }}
      onChange={handleOpacityChange}
    >
      <ToggleButton value="opaque" data-testid="opacity-opaque" aria-label="opaque lines">
        <Circle fontSize="large" />
      </ToggleButton>
      <ToggleButton
        value="translucent"
        data-testid="opacity-translucent"
        aria-label="translucent lines"
      >
        <Contrast fontSize="large" />
      </ToggleButton>
      <ToggleButton
        value="transparent"
        data-testid="opacity-transparent"
        aria-label="transparent lines"
      >
        <RadioButtonUnchecked fontSize="large" />
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

export { LineOpacityControl };
