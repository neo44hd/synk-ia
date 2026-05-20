import Layout from "./Layout.jsx";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import Albaranes from "./Albaranes";
import ApiDiagnostics from "./ApiDiagnostics";
import AttendanceControl from "./AttendanceControl";
import AutomationHub from "./AutomationHub";
import Billing from "./Billing";
import BiloopAgent from "./BiloopAgent";
import BiloopDocuments from "./BiloopDocuments";
import BiloopImport from "./BiloopImport";
import BusinessAnalysis from "./BusinessAnalysis";
import CEOBrain from "./CEOBrain";
import CEODashboard from "./CEODashboard";
import CentralAgent from "./CentralAgent";
import CompanyDocs from "./CompanyDocs";
import Comparator from "./Comparator";
import ConnectionDiagnostics from "./ConnectionDiagnostics";
import Contracts from "./Contracts";
import CronSetup from "./CronSetup";
import Dashboard from "./Dashboard";
import DocumentArchive from "./DocumentArchive";
import EmailProcessor from "./EmailProcessor";
import EmailSetup from "./EmailSetup";
import EmailTriage from "./EmailTriage";
import EmployeeHome from "./EmployeeHome";
import ExecutiveReports from "./ExecutiveReports";
import FinanceDashboard from "./FinanceDashboard";
import GestorFacturas from "./GestorFacturas";
import HRAgent from "./HRAgent";
import HRDocuments from "./HRDocuments";
import Home from "./Home";
import Invoices from "./Invoices";
import KitchenDisplay from "./KitchenDisplay";
import LegalVault from "./LegalVault";
import MutuaManager from "./MutuaManager";
import MyProfile from "./MyProfile";
import Notifications from "./Notifications";
import OrdersDashboard from "./OrdersDashboard";
import Payrolls from "./Payrolls";
import PortalGestoria from "./PortalGestoria";
import PortalLogin from "./PortalLogin";
import ProductInventory from "./ProductInventory";
import ProductionControl from "./ProductionControl";
import Providers from "./Providers";
import RGPDManager from "./RGPDManager";
import RevoDashboard from "./RevoDashboard";
import RevoManual from "./RevoManual";
import RevoSync from "./RevoSync";
import SecurityCameras from "./SecurityCameras";
import Showcase from "./Showcase";
import SmartMailbox from "./SmartMailbox";
import Staff from "./Staff";
import SystemOverview from "./SystemOverview";
import Timesheets from "./Timesheets";
import VacationRequests from "./VacationRequests";
import VeriFactu from "./VeriFactu";
import VoiceCommands from "./VoiceCommands";
import WebSync from "./WebSync";
import WorkerInterface from "./WorkerInterface";
import WorkerMobile from "./WorkerMobile";

import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';

export function createPageUrl(pageName) {
  return '/' + pageName.toLowerCase();
}

// Helper: envolver componente con ProtectedRoute
function Protected({ children, isPublic = false }) {
  return <ProtectedRoute isPublic={isPublic}>{children}</ProtectedRoute>;
}

function PagesContent() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/ceodashboard" replace />} />

        {/* Rutas públicas */}
        <Route path="/portallogin" element={<Protected isPublic><PortalLogin /></Protected>} />
        <Route path="/ordersdashboard" element={<Protected isPublic><OrdersDashboard /></Protected>} />

        {/* Rutas protegidas — el permiso se resuelve vía roles.js + checkRouteAccess */}
        <Route path="/albaranes" element={<Protected><Albaranes /></Protected>} />
        <Route path="/apidiagnostics" element={<Protected><ApiDiagnostics /></Protected>} />
        <Route path="/attendancecontrol" element={<Protected><AttendanceControl /></Protected>} />
        <Route path="/automationhub" element={<Protected><AutomationHub /></Protected>} />
        <Route path="/billing" element={<Protected><Billing /></Protected>} />
        <Route path="/biloopagent" element={<Protected><BiloopAgent /></Protected>} />
        <Route path="/biloopdocuments" element={<Protected><BiloopDocuments /></Protected>} />
        <Route path="/biloopimport" element={<Protected><BiloopImport /></Protected>} />
        <Route path="/businessanalysis" element={<Protected><BusinessAnalysis /></Protected>} />
        <Route path="/ceobrain" element={<Protected><CEOBrain /></Protected>} />
        <Route path="/ceodashboard" element={<Protected><CEODashboard /></Protected>} />
        <Route path="/centralagent" element={<Protected><CentralAgent /></Protected>} />
        <Route path="/companydocs" element={<Protected><CompanyDocs /></Protected>} />
        <Route path="/comparator" element={<Protected><Comparator /></Protected>} />
        <Route path="/connectiondiagnostics" element={<Protected><ConnectionDiagnostics /></Protected>} />
        <Route path="/contracts" element={<Protected><Contracts /></Protected>} />
        <Route path="/cronsetup" element={<Protected><CronSetup /></Protected>} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/documentarchive" element={<Protected><DocumentArchive /></Protected>} />
        <Route path="/emailprocessor" element={<Protected><EmailProcessor /></Protected>} />
        <Route path="/emailsetup" element={<Protected><EmailSetup /></Protected>} />
        <Route path="/emailtriage" element={<Protected><EmailTriage /></Protected>} />
        <Route path="/employeehome" element={<Protected><EmployeeHome /></Protected>} />
        <Route path="/executivereports" element={<Protected><ExecutiveReports /></Protected>} />
        <Route path="/financedashboard" element={<Protected><FinanceDashboard /></Protected>} />
        <Route path="/gestorfacturas" element={<Protected><GestorFacturas /></Protected>} />
        <Route path="/hragent" element={<Protected><HRAgent /></Protected>} />
        <Route path="/hrdocuments" element={<Protected><HRDocuments /></Protected>} />
        <Route path="/home" element={<Protected><Home /></Protected>} />
        <Route path="/invoices" element={<Protected><Invoices /></Protected>} />
        <Route path="/kitchendisplay" element={<Protected><KitchenDisplay /></Protected>} />
        <Route path="/legalvault" element={<Protected><LegalVault /></Protected>} />
        <Route path="/mutuamanager" element={<Protected><MutuaManager /></Protected>} />
        <Route path="/myprofile" element={<Protected><MyProfile /></Protected>} />
        <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
        <Route path="/payrolls" element={<Protected><Payrolls /></Protected>} />
        <Route path="/portalgestoria" element={<Protected><PortalGestoria /></Protected>} />
        <Route path="/productinventory" element={<Protected><ProductInventory /></Protected>} />
        <Route path="/productioncontrol" element={<Protected><ProductionControl /></Protected>} />
        <Route path="/providers" element={<Protected><Providers /></Protected>} />
        <Route path="/rgpdmanager" element={<Protected><RGPDManager /></Protected>} />
        <Route path="/revodashboard" element={<Protected><RevoDashboard /></Protected>} />
        <Route path="/revomanual" element={<Protected><RevoManual /></Protected>} />
        <Route path="/revosync" element={<Protected><RevoSync /></Protected>} />
        <Route path="/securitycameras" element={<Protected><SecurityCameras /></Protected>} />
        <Route path="/showcase" element={<Protected><Showcase /></Protected>} />
        <Route path="/smartmailbox" element={<Protected><SmartMailbox /></Protected>} />
        <Route path="/staff" element={<Protected><Staff /></Protected>} />
        <Route path="/systemoverview" element={<Protected><SystemOverview /></Protected>} />
        <Route path="/timesheets" element={<Protected><Timesheets /></Protected>} />
        <Route path="/vacationrequests" element={<Protected><VacationRequests /></Protected>} />
        <Route path="/verifactu" element={<Protected><VeriFactu /></Protected>} />
        <Route path="/voicecommands" element={<Protected><VoiceCommands /></Protected>} />
        <Route path="/websync" element={<Protected><WebSync /></Protected>} />
        <Route path="/workerinterface" element={<Protected><WorkerInterface /></Protected>} />
        <Route path="/workermobile" element={<Protected><WorkerMobile /></Protected>} />

        <Route path="*" element={<Navigate to="/ceodashboard" replace />} />
      </Routes>
    </Layout>
  );
}

export default function Pages() {
  return (
    <Router>
      <PagesContent />
    </Router>
  );
}
