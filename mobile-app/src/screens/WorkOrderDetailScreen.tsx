import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import axios from 'axios';

export default function WorkOrderDetailScreen({ route, navigation }: any) {
  const { workOrder } = route.params;
  const [status, setStatus] = useState(workOrder.status);
  const [loading, setLoading] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      // Mock API call
      // await axios.put(`https://api.cmms.local/work-orders/${workOrder.id}`, { status: newStatus });
      
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      setStatus(newStatus);
      Alert.alert('Success', `Status updated to ${newStatus}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{workOrder.description}</Text>
        <Text style={styles.asset}>{workOrder.assetName}</Text>
        
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Priority:</Text>
            <Text style={[styles.detailValue, workOrder.priority === 'High' ? styles.highPriority : styles.mediumPriority]}>
              {workOrder.priority}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Due Date:</Text>
            <Text style={styles.detailValue}>{workOrder.dueDate}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Current Status:</Text>
            <Text style={[styles.detailValue, styles.statusValue]}>{status}</Text>
          </View>
          {workOrder.is_pm && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type:</Text>
              <Text style={[styles.detailValue, { color: '#2563eb' }]}>Preventive Maintenance</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Update Status</Text>
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.btnStart]} 
          onPress={() => updateStatus('In Progress')}
          disabled={loading || status === 'In Progress' || status === 'Completed'}
        >
          <Text style={styles.actionButtonText}>Start Work</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.btnComplete]} 
          onPress={() => updateStatus('Completed')}
          disabled={loading || status === 'Completed'}
        >
          <Text style={styles.actionButtonText}>Mark Completed</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Parts & Materials</Text>
      <TouchableOpacity style={styles.requestButton} onPress={() => Alert.alert('Request Parts', 'Opening parts catalog...')}>
        <Text style={styles.requestButtonText}>+ Request Parts</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 },
  asset: { fontSize: 16, color: '#4b5563', marginBottom: 20 },
  detailsContainer: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  detailLabel: { fontSize: 14, color: '#6b7280' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  highPriority: { color: '#dc2626' },
  mediumPriority: { color: '#d97706' },
  statusValue: { color: '#2563eb' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#374151', marginBottom: 12 },
  actionsContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionButton: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  btnStart: { backgroundColor: '#f59e0b' },
  btnComplete: { backgroundColor: '#10b981' },
  actionButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  requestButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2563eb',
    borderStyle: 'dashed',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 40,
  },
  requestButtonText: { color: '#2563eb', fontWeight: 'bold', fontSize: 16 },
});
