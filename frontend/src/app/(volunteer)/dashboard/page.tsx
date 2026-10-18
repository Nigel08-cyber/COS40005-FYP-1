import type { Metadata } from "next";
import { SkillTag } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  CertificatesCard,
  ContributionHistory,
  HoursChart,
  RecommendedCard,
  UpcomingCard,
} from "@/components/volunteer/Dashboard";
import {
  getCertificates,
  getContributionHistory,
  getCurrentVolunteer,
  getMonthlyHours,
  getOpportunities,
  getSkillsContributed,
  getToday,
  getVolunteerStats,
} from "@/lib/api/volunteer";

export const metadata: Metadata = { title: "Dashboard · VolunteerHub" };

export default async function DashboardPage() {
  const [volunteer, stats, opportunities, history, monthly, skills, certificates] = await Promise.all([
    getCurrentVolunteer(),
    getVolunteerStats(),
    getOpportunities(),
    getContributionHistory(),
    getMonthlyHours(),
    getSkillsContributed(),
    getCertificates(),
  ]);

  const statTiles = [
    { label: "Total volunteer hours", value: stats.totalHours, note: `+${stats.hoursThisMonth} hrs this month`, good: true },
    { label: "Projects completed", value: stats.projectsCompleted, note: `${stats.upcomingThisWeek} upcoming this week` },
    { label: "Skills contributed", value: stats.skillsContributed, note: stats.skillsPreview },
    { label: "Certificates", value: stats.certificates, note: `${stats.certificatesReady} ready to download` },
  ];

  return (
    <>
      <PageHeader title={`Welcome back, ${volunteer.firstName}`} subtitle="Here is your volunteer impact so far." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statTiles.map((s) => (
          <Card key={s.label} interactive className="p-4">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{s.value}</p>
            <p className={s.good ? "mt-1 text-xs text-success" : "mt-1 text-xs text-muted"}>{s.note}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <UpcomingCard opportunities={opportunities} today={getToday()} />
          <ContributionHistory records={history} />
          <HoursChart data={monthly} />
        </div>

        <aside className="space-y-6">
          <RecommendedCard opportunities={opportunities} />
          <Card className="p-5">
            <CardTitle>Skills contributed</CardTitle>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <SkillTag key={s} tone="brand">
                  {s}
                </SkillTag>
              ))}
            </div>
          </Card>
          <CertificatesCard certificates={certificates} />
        </aside>
      </div>
    </>
  );
}
