import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/Colors';
import { formatDate, toISODate } from '@/src/utils/date';

interface Props {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type PickerMode = 'calendar' | 'month' | 'year';

function CalendarGrid({
  selectedDate,
  onSelect,
  onClose,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const selected = new Date(selectedDate + 'T00:00:00');
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());
  const [mode, setMode] = useState<PickerMode>('calendar');

  const currentYear = new Date().getFullYear();
  // Show years from 20 years ago to current year
  const years = Array.from({ length: 25 }, (_, i) => currentYear - 20 + i);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayPress = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    onSelect(toISODate(d));
    onClose();
  };

  const handleMonthSelect = (monthIndex: number) => {
    setViewMonth(monthIndex);
    setMode('calendar');
  };

  const handleYearSelect = (year: number) => {
    setViewYear(year);
    setMode('month');
  };

  const isSelected = (day: number) => {
    return (
      viewYear === selected.getFullYear() &&
      viewMonth === selected.getMonth() &&
      day === selected.getDate()
    );
  };

  const isToday = (day: number) => {
    const now = new Date();
    return (
      viewYear === now.getFullYear() &&
      viewMonth === now.getMonth() &&
      day === now.getDate()
    );
  };

  // ── Year Picker ──
  if (mode === 'year') {
    return (
      <View style={calStyles.container}>
        <View style={calStyles.header}>
          <Pressable onPress={() => setMode('calendar')} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={calStyles.monthYear}>Select Year</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView
          style={calStyles.pickerScroll}
          contentContainerStyle={calStyles.pickerGrid}
          showsVerticalScrollIndicator={false}
        >
          {years.map((year) => (
            <Pressable
              key={year}
              style={[
                calStyles.pickerCell,
                year === viewYear && calStyles.pickerCellSelected,
                year === currentYear && year !== viewYear && calStyles.pickerCellCurrent,
              ]}
              onPress={() => handleYearSelect(year)}
            >
              <Text
                style={[
                  calStyles.pickerCellText,
                  year === viewYear && calStyles.pickerCellTextSelected,
                  year === currentYear && year !== viewYear && calStyles.pickerCellTextCurrent,
                ]}
              >
                {year}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── Month Picker ──
  if (mode === 'month') {
    return (
      <View style={calStyles.container}>
        <View style={calStyles.header}>
          <Pressable onPress={() => setMode('year')} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => setMode('year')}>
            <Text style={calStyles.monthYearTappable}>{viewYear}</Text>
          </Pressable>
          <View style={{ width: 22 }} />
        </View>
        <View style={calStyles.pickerGrid}>
          {MONTHS_SHORT.map((m, i) => (
            <Pressable
              key={m}
              style={[
                calStyles.pickerCell,
                i === viewMonth && calStyles.pickerCellSelected,
              ]}
              onPress={() => handleMonthSelect(i)}
            >
              <Text
                style={[
                  calStyles.pickerCellText,
                  i === viewMonth && calStyles.pickerCellTextSelected,
                ]}
              >
                {m}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  // ── Calendar (day) view ──
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={calStyles.container}>
      {/* Header — tap month/year to switch modes */}
      <View style={calStyles.header}>
        <Pressable onPress={prevMonth} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          style={calStyles.monthYearButton}
          onPress={() => setMode('month')}
        >
          <Text style={calStyles.monthYearTappable}>
            {MONTHS[viewMonth]} {viewYear}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.primary} />
        </Pressable>
        <Pressable onPress={nextMonth} hitSlop={12}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Day names */}
      <View style={calStyles.dayNamesRow}>
        {DAYS.map((d) => (
          <Text key={d} style={calStyles.dayName}>{d}</Text>
        ))}
      </View>

      {/* Day grid */}
      <View style={calStyles.grid}>
        {cells.map((day, i) => (
          <Pressable
            key={i}
            style={[
              calStyles.dayCell,
              day != null && isSelected(day) ? calStyles.dayCellSelected : undefined,
              day != null && isToday(day) && !isSelected(day) ? calStyles.dayCellToday : undefined,
            ]}
            onPress={() => day && handleDayPress(day)}
            disabled={!day}
          >
            {day ? (
              <Text
                style={[
                  calStyles.dayText,
                  isSelected(day) && calStyles.dayTextSelected,
                  isToday(day) && !isSelected(day) && calStyles.dayTextToday,
                ]}
              >
                {day}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>

      {/* Today button */}
      <Pressable
        style={calStyles.todayButton}
        onPress={() => {
          const now = new Date();
          setViewYear(now.getFullYear());
          setViewMonth(now.getMonth());
          onSelect(toISODate(now));
          onClose();
        }}
      >
        <Text style={calStyles.todayButtonText}>Today</Text>
      </Pressable>
    </View>
  );
}

export function DatePicker({ value, onChange, label }: Props) {
  const [showCalendar, setShowCalendar] = useState(false);

  return (
    <View style={styles.container}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => setShowCalendar(true)}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        <Text style={styles.dateText}>{formatDate(value)}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
      </Pressable>

      {showCalendar ? (
        <Modal
          transparent
          animationType="fade"
          visible={showCalendar}
          onRequestClose={() => setShowCalendar(false)}
        >
          <Pressable
            style={styles.overlay}
            onPress={() => setShowCalendar(false)}
          >
            <Pressable style={styles.calendarModal}>
              <CalendarGrid
                selectedDate={value}
                onSelect={onChange}
                onClose={() => setShowCalendar(false)}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  labelRow: {
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: fontSize.xs + 1,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  buttonPressed: {
    backgroundColor: colors.surfaceLight,
  },
  dateText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarModal: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    width: 340,
    maxWidth: '90%',
  },
});

const calStyles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  monthYear: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  monthYearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLight,
  },
  monthYearTappable: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.full,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  dayTextSelected: {
    color: colors.white,
    fontWeight: fontWeight.bold,
  },
  dayTextToday: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  todayButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  todayButtonText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  // Month & Year picker styles
  pickerScroll: {
    maxHeight: 280,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  pickerCell: {
    width: '28%',
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
  },
  pickerCellSelected: {
    backgroundColor: colors.primary,
  },
  pickerCellCurrent: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pickerCellText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  pickerCellTextSelected: {
    color: colors.white,
    fontWeight: fontWeight.bold,
  },
  pickerCellTextCurrent: {
    color: colors.primary,
  },
});
