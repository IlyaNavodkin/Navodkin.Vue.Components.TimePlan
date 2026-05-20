import './style.css';
import { mountSchedulerApp } from './components/SchedulerApp';

const app = document.querySelector<HTMLElement>('#app');

if (!app) {
  throw new Error('App root not found');
}

mountSchedulerApp(app);
