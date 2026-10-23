import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { normalizeMobile } from '../common/mobile';
import { Db, InjectDb } from '../db/db.module';
import { dec, mobileKey } from '../common/crypto';
import {
  coreMemberships, cores, counties, networkMembers, networks, provinces, rahyarAssignments, rahyarPositions, regionProvinces, roleGrants, users,
} from '../db/schema';

export type Position = typeof rahyarPositions.$inferSelect;
type Layer = Position['layer'];
const ORDER: Layer[] = ['COUNTY', 'PROVINCIAL', 'REGIONAL', 'MANAGER', 'DEPUTY'];
export const LAYER_FA: Record<Layer, string> = { DEPUTY: 'معاون راهیاری', MANAGER: 'مسئول راهیاری', REGIONAL: 'راهیار منطقه‌ای', PROVINCIAL: 'راهیار استانی', COUNTY: 'راهیار شهرستانی' };

interface Snapshot {
  positions: Position[];
  byId: Map<string, Position>;
  regionProv: Map<string, string[]>; // regionId → provinceIds
  assign: Map<string, string>; // userId → positionId
  countyProvince: Map<string, string>;
  outside: Set<string>; // کسانی که فقط عضو سازمانِ بیرون از راهیاری‌اند
}

export interface Resolution { chain: Position[]; responsible: Position | null }

/**
 * شبکهٔ راهیاری: هر کنشگر از روی جنسیت و شهرستانش به یک راهیار می‌رسد.
 * اگر جایگاه پایین‌تر خالی باشد، مسئولیت به لایهٔ بالاتر می‌رود (شهرستانی ← استانی ← منطقه‌ای ← مسئول ← معاون).
 */
@Injectable()
export class RahyarService {
  constructor(@InjectDb() private readonly db: Db) {}

  async snapshot(): Promise<Snapshot> {
    const positions = await this.db.select().from(rahyarPositions);
    const rp = await this.db.select().from(regionProvinces);
    const as = await this.db.select().from(rahyarAssignments);
    const cs = await this.db.select({ id: counties.id, provinceId: counties.provinceId }).from(counties);
    // اعضای سازمان‌هایی که «زیر راهیاری نیستند» و عضو شبکهٔ برادران/بانور هم نیستند
    const orgOut = await this.db.select({ userId: networkMembers.userId, under: networks.underRahyar, kind: networks.kind }).from(networkMembers).innerJoin(networks, eq(networks.id, networkMembers.networkId));
    const coreNets = await this.db.select({ userId: coreMemberships.userId, under: networks.underRahyar, kind: networks.kind }).from(coreMemberships)
      .innerJoin(cores, eq(cores.id, coreMemberships.coreId)).innerJoin(networks, eq(networks.id, cores.networkId));
    const byUser = new Map<string, { under: boolean; kind: string }[]>();
    for (const r of [...orgOut, ...coreNets]) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
    const outside = new Set<string>();
    for (const [uid, ms] of byUser) if (ms.length && ms.every((m) => m.kind === 'ORGANIZATION' && !m.under)) outside.add(uid);
    const regionProv = new Map<string, string[]>();
    for (const r of rp) regionProv.set(r.regionId, [...(regionProv.get(r.regionId) ?? []), r.provinceId]);
    return {
      positions, byId: new Map(positions.map((p) => [p.id, p])), regionProv,
      assign: new Map(as.map((a) => [a.userId, a.positionId])), countyProvince: new Map(cs.map((c) => [c.id, c.provinceId])), outside,
    };
  }

  /** زنجیرهٔ جایگاه‌های بالای یک کنشگر و راهیاری که الان مسئول اوست */
  resolve(s: Snapshot, u: { id: string; gender: 'MALE' | 'FEMALE' | null; countyId: string | null }): Resolution {
    if (!u.gender || s.outside.has(u.id)) return { chain: [], responsible: null };
    const tree = s.positions.filter((p) => p.gender === u.gender);
    const provinceId = u.countyId ? s.countyProvince.get(u.countyId) : undefined;
    let start: Position | undefined;
    const explicit = s.assign.get(u.id);
    if (explicit && s.byId.get(explicit)?.gender === u.gender) start = s.byId.get(explicit);
    if (!start && u.countyId) {
      const cps = tree.filter((p) => p.layer === 'COUNTY' && p.countyId === u.countyId);
      if (cps.length === 1) start = cps[0];
    }
    if (!start && provinceId) start = tree.find((p) => p.layer === 'PROVINCIAL' && p.provinceId === provinceId);
    if (!start && provinceId) start = tree.find((p) => p.layer === 'REGIONAL' && (s.regionProv.get(p.id) ?? []).includes(provinceId));
    if (!start) start = tree.find((p) => p.layer === 'DEPUTY');
    const chain: Position[] = [];
    const seen = new Set<string>();
    let cur: Position | undefined = start;
    while (cur && !seen.has(cur.id)) { chain.push(cur); seen.add(cur.id); cur = cur.parentId ? s.byId.get(cur.parentId) : undefined; }
    // اگر زنجیره به منطقه نرسیده (استانی بدون والد)، منطقهٔ استان را اضافه کن
    if (provinceId && !chain.some((p) => p.layer === 'REGIONAL')) {
      const reg = tree.find((p) => p.layer === 'REGIONAL' && (s.regionProv.get(p.id) ?? []).includes(provinceId));
      let c2: Position | undefined = reg;
      while (c2 && !seen.has(c2.id)) { chain.push(c2); seen.add(c2.id); c2 = c2.parentId ? s.byId.get(c2.parentId) : undefined; }
    }
    if (!chain.some((p) => p.layer === 'DEPUTY')) { const d = tree.find((p) => p.layer === 'DEPUTY'); if (d && !seen.has(d.id)) chain.push(d); }
    chain.sort((a, b) => ORDER.indexOf(a.layer) - ORDER.indexOf(b.layer));
    return { chain, responsible: chain.find((p) => p.holderId) ?? null };
  }

  /** جایگاه‌هایی که این نفر دارد */
  held(s: Snapshot, userId: string) { return s.positions.filter((p) => p.holderId === userId); }

  /** همهٔ کنشگرانی که در دامنهٔ این راهیارند، با راهیار مسئول هر کدام */
  async learnersInScope(userId: string, s?: Snapshot) {
    s ??= await this.snapshot();
    const mine = new Set(this.held(s, userId).map((p) => p.id));
    if (!mine.size) return [];
    const all = await this.db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, gender: users.gender, countyId: users.countyId, mosqueId: users.mosqueId, nearMosque: users.nearMosque, allowRahyarMessages: users.allowRahyarMessages, createdAt: users.createdAt })
      .from(users).where(and(eq(users.isActive, true), isNotNull(users.gender)));
    const holderIds = new Set(s.positions.map((p) => p.holderId).filter(Boolean));
    return all.filter((u) => !holderIds.has(u.id) || true).map((u) => ({ u, r: this.resolve(s!, u) }))
      .filter(({ u, r }) => u.id !== userId && r.chain.some((p) => mine.has(p.id)))
      .map(({ u, r }) => ({ ...u, responsible: r.responsible, chain: r.chain, direct: r.responsible?.holderId === userId }));
  }

  async canSeeLearner(viewerId: string, learnerId: string, roles: string[]) {
    if (roles.includes('HQ_ADMIN') || roles.includes('HQ_OPERATOR')) return true;
    const s = await this.snapshot();
    const mine = new Set(this.held(s, viewerId).map((p) => p.id));
    if (!mine.size) return false;
    const u = await this.db.query.users.findFirst({ where: eq(users.id, learnerId), columns: { id: true, gender: true, countyId: true } });
    return !!u && this.resolve(s, u).chain.some((p) => mine.has(p.id));
  }

  /** راهیار مسئول و راهیار لایهٔ بالاتر (برای هشدار تأخیر) */
  async responsibleFor(learnerId: string) {
    const s = await this.snapshot();
    const u = await this.db.query.users.findFirst({ where: eq(users.id, learnerId), columns: { id: true, gender: true, countyId: true } });
    if (!u) return { responsible: null, above: null };
    const r = this.resolve(s, u);
    const idx = r.responsible ? r.chain.indexOf(r.responsible) : -1;
    const above = idx >= 0 ? r.chain.slice(idx + 1).find((p) => p.holderId) ?? null : null;
    return { responsible: r.responsible, above };
  }

  // ───────── مدیریت ساختار ─────────

  /** چه کسی می‌تواند درخت این جنسیت را ویرایش کند: مدیر ستاد یا معاون همان درخت */
  async assertManager(userId: string, roles: string[], gender: 'MALE' | 'FEMALE') {
    if (roles.includes('HQ_ADMIN')) return;
    const d = await this.db.query.rahyarPositions.findFirst({ where: and(eq(rahyarPositions.layer, 'DEPUTY'), eq(rahyarPositions.gender, gender), eq(rahyarPositions.holderId, userId)) });
    if (!d) throw new ForbiddenException({ code: 'forbidden', message: 'فقط معاون راهیاری همین درخت یا مدیر ستاد می‌تواند ساختار را تغییر دهد' });
  }

  async tree(gender: 'MALE' | 'FEMALE') {
    const s = await this.snapshot();
    const ps = s.positions.filter((p) => p.gender === gender);
    const holders = ps.map((p) => p.holderId).filter(Boolean) as string[];
    const hs = holders.length ? await this.db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, mobileEnc: users.mobileEnc }).from(users).where(inArray(users.id, holders)) : [];
    const pv = await this.db.select().from(provinces);
    const cs = await this.db.select().from(counties);
    // شمار کنشگرانی که مسئولشان هر جایگاه است
    const learners = await this.db.select({ id: users.id, gender: users.gender, countyId: users.countyId }).from(users).where(and(eq(users.isActive, true), eq(users.gender, gender)));
    const load = new Map<string, number>();
    for (const l of learners) { const r = this.resolve(s, l); if (r.responsible) load.set(r.responsible.id, (load.get(r.responsible.id) ?? 0) + 1); }
    return ps.map((p) => ({
      ...p, holder: (() => { const h = hs.find((x) => x.id === p.holderId); return h ? { id: h.id, firstName: h.firstName, lastName: h.lastName, mobile: dec(h.mobileEnc) } : null; })(),
      province: pv.find((x) => x.id === p.provinceId)?.name ?? null, county: cs.find((x) => x.id === p.countyId)?.name ?? null,
      regionProvinces: (s.regionProv.get(p.id) ?? []).map((id) => ({ id, name: pv.find((x) => x.id === id)?.name })),
      learnerCount: load.get(p.id) ?? 0,
    }));
  }

  private parentLayer: Record<Layer, Layer | null> = { DEPUTY: null, MANAGER: 'DEPUTY', REGIONAL: 'MANAGER', PROVINCIAL: 'REGIONAL', COUNTY: 'PROVINCIAL' };

  async createPosition(d: { gender: 'MALE' | 'FEMALE'; layer: Layer; title?: string; parentId?: string; provinceId?: string; countyId?: string }) {
    const need = this.parentLayer[d.layer];
    let parentId: string | null = null;
    if (need) {
      const parent = d.parentId ? await this.db.query.rahyarPositions.findFirst({ where: eq(rahyarPositions.id, d.parentId) }) : undefined;
      if (!parent || parent.layer !== need || parent.gender !== d.gender) throw new BadRequestException({ code: 'bad_parent', message: `جایگاه بالادست باید «${LAYER_FA[need]}» همین درخت باشد` });
      parentId = parent.id;
    } else {
      const exists = await this.db.query.rahyarPositions.findFirst({ where: and(eq(rahyarPositions.layer, 'DEPUTY'), eq(rahyarPositions.gender, d.gender)) });
      if (exists) throw new BadRequestException({ code: 'deputy_exists', message: 'هر درخت فقط یک معاون دارد' });
    }
    if (d.layer === 'PROVINCIAL' && !d.provinceId) throw new BadRequestException({ code: 'need_province', message: 'استان را انتخاب کنید' });
    if (d.layer === 'COUNTY' && !d.countyId) throw new BadRequestException({ code: 'need_county', message: 'شهرستان را انتخاب کنید' });
    let title = d.title?.trim();
    if (!title) {
      const place = d.layer === 'PROVINCIAL' ? (await this.db.query.provinces.findFirst({ where: eq(provinces.id, d.provinceId!) }))?.name
        : d.layer === 'COUNTY' ? (await this.db.query.counties.findFirst({ where: eq(counties.id, d.countyId!) }))?.name : '';
      title = `${LAYER_FA[d.layer]}${place ? ' ' + place : ''}`;
    }
    const [p] = await this.db.insert(rahyarPositions).values({ gender: d.gender, layer: d.layer, title, parentId, provinceId: d.layer === 'PROVINCIAL' ? d.provinceId : null, countyId: d.layer === 'COUNTY' ? d.countyId : null }).returning();
    return p;
  }

  async updatePosition(id: string, d: { title?: string; holderMobile?: string | null; parentId?: string }) {
    const p = await this.db.query.rahyarPositions.findFirst({ where: eq(rahyarPositions.id, id) });
    if (!p) throw new NotFoundException({ code: 'no_position', message: 'جایگاه پیدا نشد' });
    const set: Partial<Position> = {};
    if (d.title) set.title = d.title.trim();
    if (d.holderMobile !== undefined) {
      if (!d.holderMobile) set.holderId = null;
      else {
        const m = normalizeMobile(d.holderMobile);
        const u = m ? await this.db.query.users.findFirst({ where: eq(users.mobile, mobileKey(m)) }) : undefined;
        if (!u) throw new BadRequestException({ code: 'no_user', message: 'کسی با این شماره ثبت‌نام نکرده؛ اول باید در مدرسه حساب بسازد' });
        if (u.gender && u.gender !== p.gender) throw new BadRequestException({ code: 'gender', message: p.gender === 'MALE' ? 'این جایگاه در درخت برادران است' : 'این جایگاه در درخت بانور است' });
        set.holderId = u.id;
      }
    }
    if (d.parentId) {
      const parent = await this.db.query.rahyarPositions.findFirst({ where: eq(rahyarPositions.id, d.parentId) });
      if (!parent || parent.layer !== this.parentLayer[p.layer] || parent.gender !== p.gender) throw new BadRequestException({ code: 'bad_parent', message: 'جایگاه بالادست درست نیست' });
      set.parentId = parent.id;
    }
    const [u] = await this.db.update(rahyarPositions).set(set).where(eq(rahyarPositions.id, id)).returning();
    if (set.holderId) await this.db.insert(roleGrants).values({ userId: set.holderId, role: 'RAHYAR' }).onConflictDoNothing();
    return u;
  }

  async deletePosition(id: string) {
    const child = await this.db.query.rahyarPositions.findFirst({ where: eq(rahyarPositions.parentId, id) });
    if (child) throw new BadRequestException({ code: 'has_children', message: 'اول جایگاه‌های زیرمجموعه را جابه‌جا یا حذف کنید' });
    await this.db.delete(rahyarPositions).where(eq(rahyarPositions.id, id));
    return { ok: true };
  }

  async setRegionProvinces(id: string, provinceIds: string[]) {
    const p = await this.db.query.rahyarPositions.findFirst({ where: eq(rahyarPositions.id, id) });
    if (p?.layer !== 'REGIONAL') throw new BadRequestException({ code: 'not_region', message: 'استان‌ها فقط به منطقه داده می‌شوند' });
    // هر استان در هر درخت فقط در یک منطقه
    const others = await this.db.select({ regionId: regionProvinces.regionId, provinceId: regionProvinces.provinceId }).from(regionProvinces)
      .innerJoin(rahyarPositions, eq(rahyarPositions.id, regionProvinces.regionId)).where(eq(rahyarPositions.gender, p.gender));
    const taken = others.filter((o) => o.regionId !== id && provinceIds.includes(o.provinceId));
    if (taken.length) throw new BadRequestException({ code: 'province_taken', message: 'بعضی استان‌ها در منطقهٔ دیگری‌اند؛ اول از آنجا بردارید' });
    await this.db.transaction(async (tx) => {
      await tx.delete(regionProvinces).where(eq(regionProvinces.regionId, id));
      if (provinceIds.length) await tx.insert(regionProvinces).values(provinceIds.map((provinceId) => ({ regionId: id, provinceId })));
      // جایگاه‌های استانی این استان‌ها زیر همین منطقه می‌روند
      if (provinceIds.length) await tx.update(rahyarPositions).set({ parentId: id }).where(and(eq(rahyarPositions.layer, 'PROVINCIAL'), eq(rahyarPositions.gender, p.gender), inArray(rahyarPositions.provinceId, provinceIds)));
    });
    return { ok: true };
  }

  /** راهیار استانی کنشگران را بین راهیاران شهرستانی تقسیم می‌کند */
  async assign(actorId: string, roles: string[], userIds: string[], positionId: string) {
    const s = await this.snapshot();
    const target = s.byId.get(positionId);
    if (!target || target.layer !== 'COUNTY') throw new BadRequestException({ code: 'bad_target', message: 'فقط می‌شود به راهیار شهرستانی سپرد' });
    const parent = target.parentId ? s.byId.get(target.parentId) : undefined;
    const allowed = roles.includes('HQ_ADMIN') || (parent?.holderId === actorId) || this.held(s, actorId).some((p) => p.layer !== 'COUNTY' && this.isAncestor(s, p.id, target.id));
    if (!allowed) throw new ForbiddenException({ code: 'forbidden', message: 'فقط راهیار استانی همین استان می‌تواند تقسیم کند' });
    for (const uid of userIds) {
      await this.db.insert(rahyarAssignments).values({ userId: uid, positionId, assignedById: actorId })
        .onConflictDoUpdate({ target: rahyarAssignments.userId, set: { positionId, assignedById: actorId } });
    }
    return { ok: true };
  }

  private isAncestor(s: Snapshot, ancestorId: string, id: string) {
    let cur = s.byId.get(id);
    while (cur?.parentId) { if (cur.parentId === ancestorId) return true; cur = s.byId.get(cur.parentId); }
    return false;
  }

  /** کنشگرانی از استان که شهرستانشان چند راهیار دارد و هنوز به کسی سپرده نشده‌اند */
  async unassigned(actorId: string) {
    const s = await this.snapshot();
    const provincial = this.held(s, actorId).filter((p) => p.layer === 'PROVINCIAL');
    if (!provincial.length) return [];
    const out = [];
    for (const pp of provincial) {
      const countyPos = s.positions.filter((p) => p.layer === 'COUNTY' && p.parentId === pp.id);
      const multi = [...new Set(countyPos.map((p) => p.countyId))].filter((c) => countyPos.filter((p) => p.countyId === c).length > 1);
      if (!multi.length) continue;
      const us = await this.db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, countyId: users.countyId, mosqueId: users.mosqueId })
        .from(users).where(and(eq(users.gender, pp.gender), inArray(users.countyId, multi as string[])));
      for (const u of us) if (!s.assign.has(u.id)) out.push({ ...u, options: countyPos.filter((p) => p.countyId === u.countyId).map((p) => ({ id: p.id, title: p.title })) });
    }
    return out;
  }
}
