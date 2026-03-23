import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { ref } from 'vue';

// Kept for compatibility with unused ProtectedRoute component
export const isAuthenticated = ref(false);
export const authChecked = ref(false);
import ShutdownView from '../views/ShutdownView.vue';
import CommunityStatementView from '../views/CommunityStatementView.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'shutdown',
    component: ShutdownView,
    meta: { title: 'tru.watch — Service Terminated' }
  },
  {
    path: '/community-statement',
    name: 'community-statement',
    component: CommunityStatementView,
    meta: { title: 'Community Statement' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
