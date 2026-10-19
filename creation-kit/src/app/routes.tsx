import { Route, Routes } from "react-router-dom";
import { CharacterForgePage } from "../pages/CharacterForgePage";
import { HomePage } from "../pages/HomePage";
import { NotFoundPage } from "../pages/NotFoundPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/character-forge" element={<CharacterForgePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
