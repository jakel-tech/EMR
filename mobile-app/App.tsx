import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './src/screens/LoginScreen';
import WorkOrdersScreen from './src/screens/WorkOrdersScreen';
import WorkOrderDetailScreen from './src/screens/WorkOrderDetailScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="WorkOrders" component={WorkOrdersScreen} options={{ title: 'My Work Orders' }} />
        <Stack.Screen name="WorkOrderDetail" component={WorkOrderDetailScreen} options={{ title: 'Order Details' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
