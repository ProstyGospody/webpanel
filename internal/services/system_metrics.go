package services

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type SystemMetrics struct {
	CPUUsagePercent   float64   `json:"cpu_usage_percent"`
	MemoryUsedBytes   int64     `json:"memory_used_bytes"`
	MemoryTotalBytes  int64     `json:"memory_total_bytes"`
	MemoryUsedPercent float64   `json:"memory_used_percent"`
	UptimeSeconds     int64     `json:"uptime_seconds"`
	CollectedAt       time.Time `json:"collected_at"`
}

type SystemMetricsCollector struct {
	SampleDelay time.Duration
}

type cpuSample struct {
	total int64
	idle  int64
}

func NewSystemMetricsCollector() *SystemMetricsCollector {
	return &SystemMetricsCollector{
		SampleDelay: 150 * time.Millisecond,
	}
}

func (c *SystemMetricsCollector) Snapshot(ctx context.Context) (SystemMetrics, error) {
	if c.SampleDelay <= 0 {
		c.SampleDelay = 150 * time.Millisecond
	}

	cpuUsage, err := c.readCPUUsage(ctx)
	if err != nil {
		return SystemMetrics{}, err
	}

	totalMemory, availableMemory, err := readMemoryInfo()
	if err != nil {
		return SystemMetrics{}, err
	}

	uptime, err := readUptimeSeconds()
	if err != nil {
		return SystemMetrics{}, err
	}

	usedMemory := totalMemory - availableMemory
	if usedMemory < 0 {
		usedMemory = 0
	}

	usedPercent := 0.0
	if totalMemory > 0 {
		usedPercent = (float64(usedMemory) * 100) / float64(totalMemory)
	}

	return SystemMetrics{
		CPUUsagePercent:   cpuUsage,
		MemoryUsedBytes:   usedMemory,
		MemoryTotalBytes:  totalMemory,
		MemoryUsedPercent: usedPercent,
		UptimeSeconds:     uptime,
		CollectedAt:       time.Now().UTC(),
	}, nil
}

func (c *SystemMetricsCollector) readCPUUsage(ctx context.Context) (float64, error) {
	first, err := readCPUSample()
	if err != nil {
		return 0, err
	}

	timer := time.NewTimer(c.SampleDelay)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return 0, ctx.Err()
	case <-timer.C:
	}

	second, err := readCPUSample()
	if err != nil {
		return 0, err
	}

	deltaTotal := second.total - first.total
	deltaIdle := second.idle - first.idle
	if deltaTotal <= 0 {
		return 0, fmt.Errorf("invalid cpu sample delta")
	}

	busy := deltaTotal - deltaIdle
	if busy < 0 {
		busy = 0
	}

	usage := (float64(busy) * 100) / float64(deltaTotal)
	if usage < 0 {
		return 0, nil
	}
	if usage > 100 {
		return 100, nil
	}
	return usage, nil
}

func readCPUSample() (cpuSample, error) {
	file, err := os.Open("/proc/stat")
	if err != nil {
		return cpuSample{}, fmt.Errorf("open /proc/stat: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "cpu ") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			return cpuSample{}, fmt.Errorf("invalid cpu line")
		}

		var total int64
		var idle int64
		for idx := 1; idx < len(fields); idx++ {
			value, err := strconv.ParseInt(fields[idx], 10, 64)
			if err != nil {
				return cpuSample{}, fmt.Errorf("parse cpu field: %w", err)
			}
			total += value
			if idx == 4 || idx == 5 {
				idle += value
			}
		}
		return cpuSample{total: total, idle: idle}, nil
	}

	if err := scanner.Err(); err != nil {
		return cpuSample{}, fmt.Errorf("read /proc/stat: %w", err)
	}
	return cpuSample{}, fmt.Errorf("cpu line not found in /proc/stat")
}

func readMemoryInfo() (totalBytes int64, availableBytes int64, err error) {
	content, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, 0, fmt.Errorf("read /proc/meminfo: %w", err)
	}

	var totalKB int64
	var availableKB int64
	lines := strings.Split(string(content), "\n")
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		key := strings.TrimSuffix(fields[0], ":")
		value, parseErr := strconv.ParseInt(fields[1], 10, 64)
		if parseErr != nil {
			continue
		}

		switch key {
		case "MemTotal":
			totalKB = value
		case "MemAvailable":
			availableKB = value
		}
	}

	if totalKB <= 0 {
		return 0, 0, fmt.Errorf("memtotal not found in /proc/meminfo")
	}
	if availableKB < 0 {
		availableKB = 0
	}
	if availableKB > totalKB {
		availableKB = totalKB
	}

	return totalKB * 1024, availableKB * 1024, nil
}

func readUptimeSeconds() (int64, error) {
	content, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0, fmt.Errorf("read /proc/uptime: %w", err)
	}
	fields := strings.Fields(string(content))
	if len(fields) < 1 {
		return 0, fmt.Errorf("invalid /proc/uptime content")
	}
	value, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0, fmt.Errorf("parse /proc/uptime: %w", err)
	}
	if value < 0 {
		return 0, nil
	}
	return int64(value), nil
}

