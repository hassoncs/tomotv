import React, { useEffect } from "react";
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInLeft, LinearTransition, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { z } from "zod";

import { AnimatedProgressBar } from "./AnimatedProgressBar";

const TV = Platform.isTV;

// ── Schemas ──────────────────────────────────────────────────────────────────

const taskItemSchema = z.object({
  id: z.string().describe('Stable unique ID for this task — used as React key so state is preserved across re-renders. Use snake_case e.g. "search_library", "download_ep".'),
  label: z.string().describe('Short task description shown to the user. e.g. "Search library for Alone"'),
  status: z.enum(["pending", "in_progress", "completed", "failed"]).default("pending").describe("Current state of this task."),
  detail: z.string().optional().describe('Optional secondary line below the label. e.g. "Found 8 seasons" or "Starting in 2 min"'),
  progress: z.number().min(0).max(1).optional().describe("Progress 0–1 for a determinate operation (e.g. download). Shows AnimatedProgressBar. Omit for no bar."),
  progressPerSecond: z.number().positive().optional().describe("Rate of progress per second. Drives AnimatedProgressBar forward without re-renders. e.g. 0.01 = 1%/s."),
});

export const taskListPropsSchema = z.object({
  title: z.string().optional().describe('Optional header above the list. e.g. "Working on it..." or "All done!"'),
  tasks: z.array(taskItemSchema).min(1).describe("Ordered list of tasks. Always include ALL tasks on every update — only status/detail/progress change."),
});

export type TaskListProps = z.infer<typeof taskListPropsSchema>;
type Task = TaskListProps["tasks"][number];

// ── TaskItem ─────────────────────────────────────────────────────────────────

function TaskItem({ task }: { task: Task }) {
  const { status, progress, progressPerSecond, label, detail } = task;

  // Checkmark spring pop when transitioning to completed
  const checkScale = useSharedValue(status === "completed" ? 1 : 0);
  // Row opacity dims for pending items
  const rowOpacity = useSharedValue(status === "pending" ? 0.5 : 1.0);

  useEffect(() => {
    if (status === "completed") {
      checkScale.value = withSpring(1, { damping: 12, stiffness: 120 });
    } else {
      checkScale.value = withTiming(0, { duration: 150 });
    }
    rowOpacity.value = withTiming(status === "pending" ? 0.5 : 1.0, { duration: 250 });
  }, [status, checkScale, rowOpacity]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const rowStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
  }));

  const labelColor = status === "in_progress" ? "#FFC312" : status === "failed" ? "#FF453A" : status === "completed" ? "#FFFFFF" : "#636366";

  const hasProgressBar = typeof progress === "number";

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      {/* Status icon — fixed-width left column */}
      <View style={styles.iconCell}>
        {status === "in_progress" && <ActivityIndicator size="small" color="#FFC312" />}
        {status === "completed" && <Animated.Text style={[styles.checkmark, checkStyle]}>✓</Animated.Text>}
        {status === "failed" && <Text style={styles.failMark}>✗</Text>}
        {status === "pending" && <View style={styles.pendingCircle} />}
      </View>

      {/* Label + optional detail + optional progress bar */}
      <View style={styles.labelCell}>
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        {hasProgressBar ? <AnimatedProgressBar progress={progress!} progressPerSecond={progressPerSecond} height={TV ? 4 : 3} /> : null}
      </View>
    </Animated.View>
  );
}

// ── TaskList ─────────────────────────────────────────────────────────────────

export function TaskList({ title, tasks }: TaskListProps) {
  return (
    <View style={styles.container}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        scrollEnabled={false}
        removeClippedSubviews={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <Animated.View entering={FadeInLeft.duration(350)} layout={LinearTransition.springify()}>
            <TaskItem task={item} />
          </Animated.View>
        )}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  title: {
    color: "#FFC312",
    fontSize: TV ? 22 : 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: TV ? 16 : 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: TV ? 20 : 12,
    paddingVertical: TV ? 14 : 8,
  },
  iconCell: {
    width: TV ? 32 : 22,
    alignItems: "center",
    marginTop: TV ? 4 : 2, // align icon with first text baseline
  },
  labelCell: {
    flex: 1,
    gap: TV ? 6 : 4,
  },
  label: {
    fontSize: TV ? 28 : 17,
    fontWeight: "500",
    lineHeight: TV ? 36 : 22,
  },
  detail: {
    color: "#8E8E93",
    fontSize: TV ? 22 : 14,
  },
  checkmark: {
    color: "#FFC312",
    fontSize: TV ? 26 : 18,
    fontWeight: "700",
  },
  failMark: {
    color: "#FF453A",
    fontSize: TV ? 24 : 16,
    fontWeight: "700",
  },
  pendingCircle: {
    width: TV ? 18 : 14,
    height: TV ? 18 : 14,
    borderRadius: TV ? 9 : 7,
    borderWidth: 1.5,
    borderColor: "#636366",
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
});
