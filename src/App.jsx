import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingLayout from "./layouts/LandingLayout";
import PageLayout from "./layouts/PageLayout";
import LandingPage from "./pages/LandingPage";
import EventsPage from "./pages/events/EventsPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingLayout><LandingPage /></LandingLayout>} />
        <Route path="/events" element={<PageLayout><EventsPage /></PageLayout>} />
      </Routes>
    </Router>
  );
}
