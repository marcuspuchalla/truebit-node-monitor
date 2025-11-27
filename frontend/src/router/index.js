import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '../views/Dashboard.vue';
import TasksView from '../views/TasksView.vue';
import TaskDetail from '../views/TaskDetail.vue';
import InvoicesView from '../views/InvoicesView.vue';
import LogsView from '../views/LogsView.vue';
import FederationView from '../views/FederationView.vue';
import AboutView from '../views/AboutView.vue';

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: Dashboard
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: TasksView
  },
  {
    path: '/tasks/:id',
    name: 'task-detail',
    component: TaskDetail
  },
  {
    path: '/invoices',
    name: 'invoices',
    component: InvoicesView
  },
  {
    path: '/logs',
    name: 'logs',
    component: LogsView
  },
  {
    path: '/federation',
    name: 'federation',
    component: FederationView
  },
  {
    path: '/about',
    name: 'about',
    component: AboutView
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
