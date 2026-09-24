import { Route, Routes } from "react-router-dom";

import { NavBar } from "./components/layout/NavBar";
import BorrowerPage from "./pages/BorrowerPage";
import DemoPage from "./pages/DemoPage";
import LenderPage from "./pages/LenderPage";
import OverviewPage from "./pages/OverviewPage";
import RisksPage from "./pages/RisksPage";
import UnderwriterPage from "./pages/UnderwriterPage";

export default function App() {
  return (
    <div className="min-h-screen bg-grid">
      <NavBar />
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/lender" element={<LenderPage />} />
        <Route path="/borrower" element={<BorrowerPage />} />
        <Route path="/underwriter" element={<UnderwriterPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/risks" element={<RisksPage />} />
      </Routes>
    </div>
  );
}
