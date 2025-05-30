import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingLayout from "./layouts/LandingLayout";
import LandingPage from "./pages/LandingPage";
import EventsPage from "./pages/events/EventsPage";

export default function App() {
  return (
    <Router>
      <Routes>
  <Route path="/events" element={<EventsPage />} />
        <Route path="/" element={<LandingLayout><LandingPage /></LandingLayout>} />
      </Routes>
    </Router>
  );
}
