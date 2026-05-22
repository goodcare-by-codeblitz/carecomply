import { isMissingRelationError, type UserOrganization } from './orgs';

export type DashboardStats = {
	totalCarers: number;
	activeCarers: number;
	pendingReviews: number;
	expiringSoon: number;
};

export type RecentCarer = {
	id: string;
	full_name: string;
	email: string;
	status: string;
	onboarding_progress: number | null;
	created_at: string | null;
};

export type ExpiringDocument = {
	id: string;
	file_name: string;
	expiry_date: string;
	status: string;
	carers: { id: string; full_name: string } | null;
	document_types: { name: string } | null;
};

export type OrgDashboardData = {
	currentOrg: UserOrganization;
	stats: DashboardStats;
	recentCarers: RecentCarer[];
	expiringDocs: ExpiringDocument[];
};

type QueryResponse<T> = {
	data: T | null;
	count?: number | null;
	error: unknown;
};

type QueryBuilder<T> = PromiseLike<QueryResponse<T>> & {
	eq: (column: string, value: string) => QueryBuilder<T>;
	neq: (column: string, value: string) => QueryBuilder<T>;
	gte: (column: string, value: string) => QueryBuilder<T>;
	lte: (column: string, value: string) => QueryBuilder<T>;
	is: (column: string, value: null) => QueryBuilder<T>;
	not: (column: string, operator: string, value: string | null) => QueryBuilder<T>;
	order: (
		column: string,
		options?: { ascending?: boolean },
	) => QueryBuilder<T>;
	limit: (count: number) => QueryBuilder<T>;
};

type DashboardSupabaseLike = {
	from: (table: string) => {
		select: (
			columns: string,
			options?: { count?: 'exact'; head?: boolean },
		) => QueryBuilder<unknown>;
	};
};

const emptyStats: DashboardStats = {
	totalCarers: 0,
	activeCarers: 0,
	pendingReviews: 0,
	expiringSoon: 0,
};

function todayIsoDate() {
	return new Date().toISOString().split('T')[0];
}

function addDaysIsoDate(days: number) {
	const date = new Date();
	date.setDate(date.getDate() + days);
	return date.toISOString().split('T')[0];
}

async function getCount(query: PromiseLike<QueryResponse<unknown>>) {
	const { count, error } = await query;
	if (error) {
		if (!isMissingRelationError(error)) {
			console.error('Dashboard count query failed:', error);
		}
		return 0;
	}

	return count ?? 0;
}

async function getRows<T>(query: PromiseLike<QueryResponse<unknown>>) {
	const { data, error } = await query;
	if (error) {
		if (!isMissingRelationError(error)) {
			console.error('Dashboard list query failed:', error);
		}
		return [] as T[];
	}

	return Array.isArray(data) ? (data as T[]) : [];
}

export async function getOrgScopedDashboardData(
	supabase: unknown,
	currentOrg: UserOrganization,
): Promise<OrgDashboardData> {
	const client = supabase as DashboardSupabaseLike;
	const today = todayIsoDate();
	const thirtyDaysFromNow = addDaysIsoDate(30);

	const totalCarersQuery = client
		.from('carers')
		.select('*', { count: 'exact', head: true })
		.eq('organization_id', currentOrg.id)
		.neq('status', 'former');

	const activeCarersQuery = client
		.from('carers')
		.select('*', { count: 'exact', head: true })
		.eq('organization_id', currentOrg.id)
		.eq('status', 'active');

	const pendingReviewsQuery = client
		.from('documents')
		.select('id, carers!inner(organization_id)', { count: 'exact', head: true })
		.eq('carers.organization_id', currentOrg.id)
		.eq('status', 'pending');

	const expiringSoonQuery = client
		.from('documents')
		.select('id, carers!inner(organization_id)', { count: 'exact', head: true })
		.eq('carers.organization_id', currentOrg.id)
		.neq('status', 'obsolete')
		.is('superseded_by', null)
		.not('expiry_date', 'is', null)
		.gte('expiry_date', today)
		.lte('expiry_date', thirtyDaysFromNow);

	const recentCarersQuery = client
		.from('carers')
		.select('id, full_name, email, status, onboarding_progress, created_at')
		.eq('organization_id', currentOrg.id)
		.neq('status', 'former')
		.order('created_at', { ascending: false })
		.limit(5);

	const expiringDocsQuery = client
		.from('documents')
		.select(
			'id, file_name, expiry_date, status, carers!inner(id, full_name, organization_id), document_types(name)',
		)
		.eq('carers.organization_id', currentOrg.id)
		.neq('status', 'obsolete')
		.is('superseded_by', null)
		.not('expiry_date', 'is', null)
		.gte('expiry_date', today)
		.lte('expiry_date', thirtyDaysFromNow)
		.order('expiry_date', { ascending: true })
		.limit(5);

	const [
		totalCarers,
		activeCarers,
		pendingReviews,
		expiringSoon,
		recentCarers,
		expiringDocs,
	] = await Promise.all([
		getCount(totalCarersQuery),
		getCount(activeCarersQuery),
		getCount(pendingReviewsQuery),
		getCount(expiringSoonQuery),
		getRows<RecentCarer>(recentCarersQuery),
		getRows<ExpiringDocument>(expiringDocsQuery),
	]);

	return {
		currentOrg,
		stats: {
			...emptyStats,
			totalCarers,
			activeCarers,
			pendingReviews,
			expiringSoon,
		},
		recentCarers,
		expiringDocs,
	};
}
