import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { ref } from 'vue';
import Dashboard from '../views/Dashboard.vue';
import TasksView from '../views/TasksView.vue';
import TaskDetail from '../views/TaskDetail.vue';
import InvoicesView from '../views/InvoicesView.vue';
import LogsView from '../views/LogsView.vue';
import FederationView from '../views/FederationView.vue';
import AboutView from '../views/AboutView.vue';
import OnChainView from '../views/OnChainView.vue';
import TokenView from '../views/TokenView.vue';
import NodeRegistryView from '../views/NodeRegistryView.vue';
import StakingView from '../views/StakingView.vue';
import ProtectedRoute from '../views/ProtectedRoute.vue';

// Extend route meta type
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    title?: string;
  }
}

// Shared auth state - will be synced with usePreloader
export const isAuthenticated = ref(false);
export const authChecked = ref(false);

const routes: RouteRecordRaw[] = [
  // Public routes - no auth required
  {
    path: '/',
    name: 'federation',
    component: FederationView,
    meta: { requiresAuth: false, title: 'Network' }
  },
  {
    path: '/about',
    name: 'about',
    component: AboutView,
    meta: { requiresAuth: false, title: 'About' }
  },
  {
    path: '/contracts',
    name: 'contracts',
    component: OnChainView,
    meta: { requiresAuth: false, title: 'Contracts' }
  },
  {
    path: '/token',
    name: 'token',
    component: TokenView,
    meta: { requiresAuth: false, title: 'Token' }
  },
  {
    path: '/nodes',
    name: 'nodes',
    component: NodeRegistryView,
    meta: { requiresAuth: false, title: 'Nodes' }
  },
  {
    path: '/staking',
    name: 'staking',
    component: StakingView,
    meta: { requiresAuth: false, title: 'Staking' }
  },

  // Protected routes - auth required
  {
    path: '/dashboard',
    name: 'dashboard',
    component: ProtectedRoute,
    meta: { requiresAuth: true, title: 'Dashboard' },
    props: { component: Dashboard }
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: ProtectedRoute,
    meta: { requiresAuth: true, title: 'Tasks' },
    props: { component: TasksView }
  },
  {
    path: '/tasks/:id',
    name: 'task-detail',
    component: ProtectedRoute,
    meta: { requiresAuth: true, title: 'Task Detail' },
    props: (route) => ({ component: TaskDetail, id: route.params.id })
  },
  {
    path: '/invoices',
    name: 'invoices',
    component: ProtectedRoute,
    meta: { requiresAuth: true, title: 'Invoices' },
    props: { component: InvoicesView }
  },
  {
    path: '/logs',
    name: 'logs',
    component: ProtectedRoute,
    meta: { requiresAuth: true, title: 'Logs' },
    props: { component: LogsView }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
