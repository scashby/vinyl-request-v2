import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingLayout from "./layouts/LandingLayout";
import LandingPage from "./pages/LandingPage";
import EventsPage from "./pages/events/EventsPage";
import BrowseQueue from "./pages/browse/BrowseQueue";

export default function App() {
  return (
    <Router>
      <Routes>
  <Route path="/events" element={<EventsPage />} />
        <Route path="/" element={<LandingLayout><LandingPage /></LandingLayout>} />
        <Route path="/browse-queue" element={<BrowseQueue />} />
      </Routes>
    </Router>
  );
}
