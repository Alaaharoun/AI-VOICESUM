import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';

interface SubscriptionPlanProps {
  title: string;
  price: string;
  period: string;
  features: string[];
  isPopular?: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export function SubscriptionPlan({
  title,
  price,
  period,
  features,
  isPopular = false,
  onSelect,
  disabled = false,
}: SubscriptionPlanProps) {
  return (
    <View style={[styles.container, isPopular && styles.popularContainer]}>
      {isPopular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>Most Popular</Text>
        </View>
      )}
      
      <Text style={styles.title}>{title}</Text>
      
      <View style={styles.priceContainer}>
        <Text style={styles.price}>{price}</Text>
        <Text style={styles.period}>/{period}</Text>
      </View>
      
      <View style={styles.featuresContainer}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Check size={16} color="#10B981" />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
      
      <TouchableOpacity
        style={[
          styles.selectButton,
          isPopular && styles.popularButton,
          disabled && styles.disabledButton,
        ]}
        onPress={onSelect}
        disabled={disabled}
      >
        <Text style={[
          styles.selectButtonText,
          isPopular && styles.popularButtonText,
          disabled && styles.disabledButtonText,
        ]}>
          {disabled ? 'Coming Soon' : 'Select Plan'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    margin: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  popularContainer: {
    borderColor: '#2563EB',
    transform: [{ scale: 1.05 }],
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  popularText: {
    backgroundColor: '#2563EB',
    color: 'white',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 24,
  },
  price: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1F2937',
  },
  period: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 4,
  },
  featuresContainer: {
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  selectButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  popularButton: {
    backgroundColor: '#2563EB',
  },
  disabledButton: {
    backgroundColor: '#F9FAFB',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  popularButtonText: {
    color: 'white',
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
});