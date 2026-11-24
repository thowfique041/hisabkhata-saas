'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { announcementSchema } from '@hisabkhata/shared';
import { api } from '@/lib/api';
import { useAction, useApi, useList } from '@/hooks/use-api';
import { PageHeader, Pagination, Panel, Stat, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useConfirm } from '@/components/confirm';
import { formatDate, titleCase } from '@/lib/utils';

function System() {
  const { data } = useApi<any>('/admin/system');
  if (!data) return <TableSkeleton rows={6} cols={2} />;
  return (
    <Panel title="Runtime configuration" bodyClass="px-4">
      <Stat label="Environment">{data.environment}</Stat>
      <Stat label="File storage">{data.storageDriver}</Stat>
      <Stat label="Background jobs">{data.queuesEnabled ? (data.redisReachable ? <Badge tone="positive">Redis connected</Badge> : <Badge tone="negative">Redis unreachable</Badge>) : <Badge>Inline (no Redis)</Badge>}</Stat>
      <Stat label="Outgoing email">{data.smtpConfigured ? data.mailFrom : <Badge tone="warning">SMTP not configured</Badge>}</Stat>
      <Stat label="Payment providers">{data.paymentProviders.map((p: any) => p.name).join(', ')}</Stat>
      <Stat label="App URL">{data.appUrl}</Stat>
      <Stat label="Allowed origins">{data.corsOrigins.join(', ')}</Stat>
    </Panel>
  );
}

function Jobs() {
  const { data, refetch } = useApi<any>('/admin/jobs');
  const retry = useAction(({ q, id }: { q: string; id: string }) => api(`/admin/jobs/${q}/${id}/retry`, { method: 'POST' }), { success: 'Job queued again', onSuccess: () => refetch() });
  const run = useAction((name: string) => api(`/admin/jobs/run/${name}`, { method: 'POST' }), { success: (r: any) => `Done: ${JSON.stringify(r)}` });
  if (!data) return <TableSkeleton />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => run.mutate('subscription-expiry')} loading={run.isPending}>
          Run subscription expiry check
        </Button>
        <Button variant="outline" size="sm" onClick={() => run.mutate('low-stock-digest')} loading={run.isPending}>
          Send low-stock digests
        </Button>
      </div>
      {!data.enabled ? (
        <p className="text-sm text-muted-foreground">Queues are disabled (QUEUES_ENABLED=false); jobs run inline with the request.</p>
      ) : (
        data.queues.map((q: any) => (
          <Panel key={q.name} title={`Queue: ${q.name}`}>
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-b px-4 py-2.5 text-sm">
              {Object.entries(q.counts).map(([k, v]) => (
                <span key={k}>
                  <span className="text-muted-foreground">{titleCase(k)} </span>
                  <span className="num font-medium">{String(v)}</span>
                </span>
              ))}
            </div>
            {q.failed.length ? (
              <table className="ledger">
                <tbody>
                  {q.failed.map((j: any) => (
                    <tr key={j.id}>
                      <td>
                        {j.name}
                        <p className="text-xs text-negative">{j.failedReason}</p>
                      </td>
                      <td className="text-xs text-muted-foreground">{j.attemptsMade} attempts</td>
                      <td className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => retry.mutate({ q: q.name, id: j.id })}>
                          Retry
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">No failed jobs.</p>
            )}
          </Panel>
        ))
      )}
    </div>
  );
}

function Emails() {
  const list = useList<any>('/admin/email-logs', { pageSize: 30 });
  return (
    <div className="rounded-lg border bg-surface">
      <div className="border-b p-3">
        <Select className="w-40" value={String(list.params.status ?? '')} onChange={(e) => list.set({ status: e.target.value })} aria-label="Status">
          <option value="">All emails</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
          <option value="QUEUED">Queued</option>
        </Select>
      </div>
      <table className="ledger">
        <tbody>
          {list.data?.items.map((m: any) => (
            <tr key={m.id}>
              <td className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(m.createdAt, undefined, true)}</td>
              <td>
                {m.subject}
                <p className="text-xs text-muted-foreground">{m.to}</p>
                {m.error && <p className="text-xs text-negative">{m.error}</p>}
              </td>
              <td>
                <Badge tone={m.status === 'SENT' ? 'positive' : m.status === 'FAILED' ? 'negative' : 'warning'}>{titleCase(m.status)}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.data && <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />}
    </div>
  );
}

function Announcements() {
  const { data } = useApi<any[]>('/admin/announcements');
  const confirm = useConfirm();
  const form = useForm<any>({ resolver: zodResolver(announcementSchema), defaultValues: { title: '', body: '', level: 'INFO', isActive: true } });
  const create = useAction((v: any) => api('/admin/announcements', { method: 'POST', body: v }), { success: 'Announcement published', invalidate: [['/admin/announcements'], ['/announcements']], onSuccess: () => form.reset() });
  const toggle = useAction((a: any) => api(`/admin/announcements/${a.id}`, { method: 'PUT', body: { title: a.title, body: a.body, level: a.level, isActive: !a.isActive } }), { invalidate: [['/admin/announcements']] });
  const del = useAction((id: string) => api(`/admin/announcements/${id}`, { method: 'DELETE' }), { success: 'Deleted', invalidate: [['/admin/announcements']] });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Panel title="Announcements">
        <table className="ledger">
          <tbody>
            {data?.map((a) => (
              <tr key={a.id}>
                <td>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.body}</p>
                </td>
                <td>
                  <Badge tone={a.level === 'CRITICAL' ? 'negative' : a.level === 'WARNING' ? 'warning' : 'info'}>{titleCase(a.level)}</Badge>
                </td>
                <td className="whitespace-nowrap text-right">
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate(a)}>
                    {a.isActive ? 'Hide' : 'Show'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-negative" onClick={async () => (await confirm({ title: 'Delete announcement?', description: 'It disappears for every user.', confirmLabel: 'Delete', destructive: true })) && del.mutate(a.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {!data?.length && (
              <tr>
                <td className="py-6 text-center text-sm text-muted-foreground">No announcements.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
      <Panel title="New announcement" bodyClass="p-4">
        <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-3" noValidate>
          <Field label="Title" htmlFor="at">
            <Input id="at" {...form.register('title')} />
          </Field>
          <Field label="Message" htmlFor="ab">
            <Textarea id="ab" rows={3} {...form.register('body')} />
          </Field>
          <Field label="Level" htmlFor="al">
            <Select id="al" {...form.register('level')}>
              <option value="INFO">Information</option>
              <option value="WARNING">Warning</option>
              <option value="CRITICAL">Critical</option>
            </Select>
          </Field>
          <Button type="submit" loading={create.isPending}>
            Publish to all businesses
          </Button>
        </form>
      </Panel>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader title="System" description="Platform configuration, background jobs, email delivery and announcements." />
      <Tabs defaultValue="system">
        <TabsList className="mb-5">
          <TabsTrigger value="system">Configuration</TabsTrigger>
          <TabsTrigger value="jobs">Background jobs</TabsTrigger>
          <TabsTrigger value="emails">Email log</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>
        <TabsContent value="system" className="max-w-3xl">
          <System />
        </TabsContent>
        <TabsContent value="jobs">
          <Jobs />
        </TabsContent>
        <TabsContent value="emails">
          <Emails />
        </TabsContent>
        <TabsContent value="announcements">
          <Announcements />
        </TabsContent>
      </Tabs>
    </>
  );
}
