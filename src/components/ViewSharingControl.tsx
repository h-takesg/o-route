import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import Person from "@mui/icons-material/Person";
import { FaChessKing } from "react-icons/fa";
import People from "@mui/icons-material/People";
import { ViewMode } from "../types";

type Props = {
  viewMode: ViewMode;
  setViewMode: (next: ViewMode) => void;
};

function ViewSharingControl({ viewMode, setViewMode }: Props) {
  const handleModeChange = (
    event: React.MouseEvent<HTMLElement>,
    nextView: ViewMode
  ) => {
    if (nextView !== null) {
      setViewMode(nextView);
    }
  };

  return (
    <>
      <ToggleButtonGroup
        orientation="vertical"
        value={viewMode}
        exclusive
        size="large"
        color="primary"
        sx={{
          background: "white",
          borderRadius: "4px",
          boxShadow: 20,
          margin: "1rem",
        }}
        onChange={handleModeChange}
      >
        <ToggleButton value="single">
          <Person fontSize="large" />
        </ToggleButton>
        <ToggleButton value="leader">
          <FaChessKing style={{ fontSize: "1.7rem" }} />
        </ToggleButton>
        <ToggleButton value="follwer">
          <People fontSize="large" />
        </ToggleButton>
      </ToggleButtonGroup>
    </>
  );
}

export { ViewSharingControl };
