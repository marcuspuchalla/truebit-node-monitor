import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import Dashboard from '../views/Dashboard.vue';
import TasksView from '../views/TasksView.vue';
import TaskDetail from '../views/TaskDetail.vue';
import InvoicesView from '../views/InvoicesView.vue';
import LogsView from '../views/LogsView.vue';
import FederationView from '../views/FederationView.vue';
import AboutView from '../views/AboutView.vue';

// Extend route meta type
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    title?: string;
  }
}

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

  // Protected routes - auth required
  {
    path: '/dashboard',
    name: 'dashboard',
    component: Dashboard,
    meta: { requiresAuth: true, title: 'Dashboard' }
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: TasksView,
    meta: { requiresAuth: true, title: 'Tasks' }
  },
  {
    path: '/tasks/:id',
    name: 'task-detail',
    component: TaskDetail,
    meta: { requiresAuth: true, title: 'Task Detail' }
  },
  {
    path: '/invoices',
    name: 'invoices',
    component: InvoicesView,
    meta: { requiresAuth: true, title: 'Invoices' }
  },
  {
    path: '/logs',
    name: 'logs',
    component: LogsView,
    meta: { requiresAuth: true, title: 'Logs' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
