import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Auth from "./pages/Auth";
import PatientProfile from "./pages/patient/PatientProfile";
import MedicalRecords from "./pages/patient/MedicalRecords";
import Documents from "./pages/patient/Documents";
import HealthTimeline from "./pages/patient/HealthTimeline";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import DoctorProfile from "./pages/doctor/DoctorProfile";
import FindDoctors from "./pages/patient/FindDoctors";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/patient" element={<ProtectedRoute allowedRole="patient"><PatientProfile /></ProtectedRoute>} />
            <Route path="/patient/records" element={<ProtectedRoute allowedRole="patient"><MedicalRecords /></ProtectedRoute>} />
            <Route path="/patient/documents" element={<ProtectedRoute allowedRole="patient"><Documents /></ProtectedRoute>} />
            <Route path="/patient/timeline" element={<ProtectedRoute allowedRole="patient"><HealthTimeline /></ProtectedRoute>} />
            <Route path="/patient/doctors" element={<ProtectedRoute allowedRole="patient"><FindDoctors /></ProtectedRoute>} />
            <Route path="/doctor" element={<ProtectedRoute allowedRole="doctor"><DoctorDashboard /></ProtectedRoute>} />
            <Route path="/doctor/profile" element={<ProtectedRoute allowedRole="doctor"><DoctorProfile /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
