package com.devops.todo.dto;

public record TaskDto (
        String id,
        String title,
        String desc,
        String quad,
        String date,       // "YYYY-MM-DD" oder null
        boolean done,
        long createdAt,
        Long doneAt        // null oder epoch millis
) {}
