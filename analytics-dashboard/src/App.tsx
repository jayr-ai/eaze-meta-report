import './App.css'
import {
  Sidebar,
  Header,
  KpiCard,
  PerformanceChart,
  GradeDistributionChart,
  AttendanceGauge,
  TopCoursesChart,
  StudentsByYearChart,
  RevenueChart,
  DataTable,
  AlertsPanel,
  QuickActions,
  Footer,
} from './components'
import {
  mockKPIs,
  mockPerformanceOverview,
  mockGradeDistribution,
  mockAttendanceOverview,
  mockTopCourses,
  mockStudentsByYear,
  mockRevenueByMonth,
  mockStudentPerformance,
  mockAlerts,
  mockQuickActions,
} from './data/mock'

function App() {
  return (
    <div className="flex h-screen bg-navy-900">
      <Sidebar />

      <main className="flex-1 lg:ml-60 overflow-y-auto pt-16 lg:pt-0">
        <div className="w-full min-h-screen px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <Header />

            {/* KPI Cards Row - Proper Spacing */}
            <div className="w-full -mx-8 px-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 lg:gap-8">
                {mockKPIs.map((kpi) => (
                  <KpiCard
                    key={kpi.id}
                    label={kpi.label}
                    value={kpi.value}
                    delta={kpi.delta}
                    icon={kpi.icon}
                    gradient={kpi.gradient}
                    bgGradient={kpi.bgGradient}
                  />
                ))}
              </div>
            </div>

            {/* Row 1: Performance + Grade Distribution */}
            <div className="w-full">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <PerformanceChart data={mockPerformanceOverview} />
                </div>
                <div className="lg:col-span-1">
                  <GradeDistributionChart data={mockGradeDistribution} />
                </div>
              </div>
            </div>

            {/* Row 2: Attendance + Top Courses */}
            <div className="w-full">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <AttendanceGauge {...mockAttendanceOverview} />
                </div>
                <div className="lg:col-span-2">
                  <TopCoursesChart data={mockTopCourses} />
                </div>
              </div>
            </div>

            {/* Row 3: Students by Year + Revenue */}
            <div className="w-full">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <StudentsByYearChart data={mockStudentsByYear} />
                </div>
                <div className="lg:col-span-2">
                  <RevenueChart data={mockRevenueByMonth} />
                </div>
              </div>
            </div>

            {/* Row 4: Table + Alerts + Quick Actions */}
            <div className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="md:col-span-1 lg:col-span-1">
                  <DataTable data={mockStudentPerformance} />
                </div>
                <div className="md:col-span-1 lg:col-span-1">
                  <AlertsPanel alerts={mockAlerts} />
                </div>
                <div className="md:col-span-2 lg:col-span-1">
                  <QuickActions actions={mockQuickActions} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <Footer />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
