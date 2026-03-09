package com.devops.todo.controller;

import com.devops.todo.dto.TaskDTO;
import com.devops.todo.entity.TaskType;
import com.devops.todo.service.TaskService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TaskController.class)
class TaskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TaskService taskService;

    @Test
    void getAllTasks_shouldReturnTaskList() throws Exception {
        TaskDTO task = new TaskDTO(
                1L,
                "Test Task",
                "Beschreibung",
                TaskType.STRATEGISCH,
                LocalDate.of(2026, 3, 15),
                false
        );

        when(taskService.getAllTasks()).thenReturn(List.of(task));

        mockMvc.perform(get("/api/tasks"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(content().json("""
                        [
                          {
                            "id": 1,
                            "title": "Test Task",
                            "description": "Beschreibung",
                            "type": "STRATEGISCH",
                            "dueDate": "2026-03-15",
                            "completed": false
                          }
                        ]
                        """));
    }

    @Test
    void createTask_shouldReturnSavedTask() throws Exception {
        TaskDTO savedTask = new TaskDTO(
                1L,
                "Neue Task",
                "Erste Aufgabe",
                TaskType.STRATEGISCH,
                LocalDate.of(2026, 3, 15),
                false
        );

        when(taskService.saveTask(any(TaskDTO.class))).thenReturn(savedTask);

        mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Neue Task",
                                  "description": "Erste Aufgabe",
                                  "type": "STRATEGISCH",
                                  "dueDate": "2026-03-15",
                                  "completed": false
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(content().json("""
                        {
                          "id": 1,
                          "title": "Neue Task",
                          "description": "Erste Aufgabe",
                          "type": "STRATEGISCH",
                          "dueDate": "2026-03-15",
                          "completed": false
                        }
                        """));
    }

    @Test
    void updateTask_shouldReturnUpdatedTask() throws Exception {
        TaskDTO updatedTask = new TaskDTO(
                1L,
                "Aktualisierte Task",
                "Neue Beschreibung",
                TaskType.STRATEGISCH,
                LocalDate.of(2026, 3, 20),
                true
        );

        when(taskService.updateTask(eq(1L), any(TaskDTO.class))).thenReturn(updatedTask);

        mockMvc.perform(put("/api/tasks/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Aktualisierte Task",
                                  "description": "Neue Beschreibung",
                                  "type": "STRATEGISCH",
                                  "dueDate": "2026-03-20",
                                  "completed": true
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(content().json("""
                        {
                          "id": 1,
                          "title": "Aktualisierte Task",
                          "description": "Neue Beschreibung",
                          "type": "STRATEGISCH",
                          "dueDate": "2026-03-20",
                          "completed": true
                        }
                        """));
    }

    @Test
    void toggleComplete_shouldReturnUpdatedTask() throws Exception {
        TaskDTO toggledTask = new TaskDTO(
                1L,
                "Test Task",
                "Beschreibung",
                TaskType.STRATEGISCH,
                LocalDate.of(2026, 3, 15),
                true
        );

        when(taskService.toggleComplete(1L)).thenReturn(toggledTask);

        mockMvc.perform(patch("/api/tasks/1/complete"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(content().json("""
                        {
                          "id": 1,
                          "title": "Test Task",
                          "description": "Beschreibung",
                          "type": "STRATEGISCH",
                          "dueDate": "2026-03-15",
                          "completed": true
                        }
                        """));
    }

    @Test
    void deleteTask_shouldReturnNoContent() throws Exception {
        doNothing().when(taskService).deleteTask(1L);

        mockMvc.perform(delete("/api/tasks/1"))
                .andExpect(status().isNoContent());
    }
}