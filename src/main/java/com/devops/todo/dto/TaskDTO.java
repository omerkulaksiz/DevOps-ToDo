package com.devops.todo.dto;

import com.devops.todo.entity.TaskType;

import java.time.LocalDate;

public class TaskDTO {


    private Long id;
    private String title;
    private String description;
    private TaskType type;
    private LocalDate dueDate;
    private boolean completed;

    public TaskDTO() {
    }

    public TaskDTO(Long id, String title, String description, TaskType type, LocalDate dueDate, boolean completed) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.type = type;
        this.dueDate = dueDate;
        this.completed = completed;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public TaskType getType() {
        return type;
    }

    public void setType(TaskType type) {
        this.type = type;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }
}
