import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  routes: [
    { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },
    { path: '/search', name: 'search', component: () => import('@/pages/SearchPage.vue') },
    { path: '/systems', name: 'systems', component: () => import('@/pages/SystemsPage.vue') },
    {
      path: '/systems/:systemId',
      name: 'system-games',
      component: () => import('@/pages/SystemGamesPage.vue'),
      props: true,
    },
    {
      path: '/games/:gameId',
      name: 'game',
      component: () => import('@/pages/GamePage.vue'),
      props: true,
    },
    {
      path: '/users/:username',
      name: 'player',
      component: () => import('@/pages/PlayerPage.vue'),
      props: true,
    },
    {
      path: '/leaderboards',
      name: 'leaderboards',
      component: () => import('@/pages/LeaderboardsPage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
    },
  ],
})
