import Layout from "./Layout.jsx";

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

import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';

export function createPageUrl(pageName) {
  return '/' + pageName.toLowerCase();
}

function PagesContent() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/ceodashboard" replace />} />
        <Route path="/albaranes" element={<Albaranes />} />
        <Route path="/apidiagnostics" element={<ApiDiagnostics />} />
        <Route path="/attendancecontrol" element={<AttendanceControl />} />
        <Route path="/automationhub" element={<AutomationHub />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/biloopagent" element={<BiloopAgent />} />
        <Route path="/biloopdocuments" element={<BiloopDocuments />} />
        <Route path="/biloopimport" element={<BiloopImport />} />
        <Route path="/businessanalysis" element={<BusinessAnalysis />} />
        <Route path="/ceobrain" element={<CEOBrain />} />
        <Route path="/ceodashboard" element={<CEODashboard />} />
        <Route path="/centralagent" element={<CentralAgent />} />
        <Route path="/companydocs" element={<CompanyDocs />} />
        <Route path="/comparator" element={<Comparator />} />
        <Route path="/connectiondiagnostics" element={<ConnectionDiagnostics />} />
        <Route path="/contracts" element={<Contracts />} />
        <Route path="/cronsetup" element={<CronSetup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/documentarchive" element={<DocumentArchive />} />
        <Route path="/emailprocessor" element={<EmailProcessor />} />
        <Route path="/emailsetup" element={<EmailSetup />} />
        <Route path="/emailtriage" element={<EmailTriage />} />
        <Route path="/employeehome" element={<EmployeeHome />} />
        <Route path="/executivereports" element={<ExecutiveReports />} />
        <Route path="/financedashboard" element={<FinanceDashboard />} />
        <Route path="/gestorfacturas" element={<GestorFacturas />} />
        <Route path="/hragent" element={<HRAgent />} />
        <Route path="/hrdocuments" element={<HRDocuments />} />
        <Route path="/home" element={<Home />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/kitchendisplay" element={<KitchenDisplay />} />
        <Route path="/legalvault" element={<LegalVault />} />
        <Route path="/mutuamanager" element={<MutuaManager />} />
        <Route path="/myprofile" element={<MyProfile />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/ordersdashboard" element={<OrdersDashboard />} />
        <Route path="/payrolls" element={<Payrolls />} />
        <Route path="/portalgestoria" element={<PortalGestoria />} />
        <Route path="/portallogin" element={<PortalLogin />} />
        <Route path="/productinventory" element={<ProductInventory />} />
        <Route path="/productioncontrol" element={<ProductionControl />} />
        <Route path="/providers" element={<Providers />} />
        <Route path="/rgpdmanager" element={<RGPDManager />} />
        <Route path="/revodashboard" element={<RevoDashboard />} />
        <Route path="/revomanual" element={<RevoManual />} />
        <Route path="/revosync" element={<RevoSync />} />
        <Route path="/securitycameras" element={<SecurityCameras />} />
        <Route path="/showcase" element={<Showcase />} />
        <Route path="/smartmailbox" element={<SmartMailbox />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/systemoverview" element={<SystemOverview />} />
        <Route path="/timesheets" element={<Timesheets />} />
        <Route path="/vacationrequests" element={<VacationRequests />} />
        <Route path="/verifactu" element={<VeriFactu />} />
        <Route path="/voicecommands" element={<VoiceCommands />} />
        <Route path="/websync" element={<WebSync />} />
        <Route path="/workerinterface" element={<WorkerInterface />} />
        <Route path="/workermobile" element={<WorkerMobile />} />
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
