import { registerRootComponent } from 'expo';

// Définit la tâche GPS d'arrière-plan avant tout rendu (réveil par l'OS)
import './src/services/locationService';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
