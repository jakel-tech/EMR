import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export default function WorkOrdersScreen({ navigation }: any) {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const fetchWorkOrders = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      // Mock API call
      // const response = await axios.get('https://api.cmms.local/work-orders/my', {
      //   headers: { Authorization: `Bearer ${token}` }
      // });
      // setWorkOrders(response.data);
      
      // Simulate data
      await new Promise(resolve => setTimeout(resolve, 1000));
      setWorkOrders([
        { id: 'w1', description: 'Replace X-Ray tube', assetName: 'X-Ray Machine', status: 'In Progress', priority: 'High', dueDate: '2026-04-02' },
        { id: 'w2', description: 'Fix battery issue', assetName: 'Defibrillator', status: 'Pending', priority: 'High', dueDate: '2026-04-01' },
        { id: 'pm1', description: 'Monthly PM', assetName: 'MRI Scanner', status: 'Pending', priority: 'Medium', dueDate: '2026-04-10', is_pm: true },
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: any) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('WorkOrderDetail', { workOrder: item })}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{item.description}</Text>
        <View style={[styles.badge, item.priority === 'High' ? styles.highPriority : styles.mediumPriority]}>
          <Text style={styles.badgeText}>{item.priority}</Text>
        </View>
      </View>
      <Text style={styles.asset}>{item.assetName}</Text>
      <View style={styles.footer}>
        <Text style={styles.date}>Due: {item.dueDate}</Text>
        <Text style={[styles.status, item.status === 'Pending' ? styles.pending : styles.inProgress]}>
          {item.status}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={workOrders}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  highPriority: { backgroundColor: '#fee2e2' },
  mediumPriority: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 10, fontWeight: 'bold', color: '#111827' },
  asset: { fontSize: 14, color: '#4b5563', marginBottom: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 12, color: '#6b7280' },
  status: { fontSize: 12, fontWeight: 'bold' },
  pending: { color: '#dc2626' },
  inProgress: { color: '#d97706' },
});
