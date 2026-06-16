# LaTeX resume structure

1. Contact Block (Name, Email, Phone, LinkedIn)
2. Summary/Intro (Brief candidate statement)
3. Education (University, Degree, Location, Dates, CGPA)
4. Skills (Grouped by category, e.g., Languages, Core Concepts, AI & Agentic Tools, Technologies/Frameworks, Cloud & Tools)
5. Experience (Reverse chronological, detailed description with bullet points)
6. Projects (Detailed description with bullet points)

Job block template:

```latex
\textbf{Title} \hfill (Dates) \\
Company $\cdot$ Location
\begin{itemize}[leftmargin=*,noitemsep,topsep=3pt]
    \item Bullet with metric when available
\end{itemize}
```

Ensure all LaTeX special characters (such as `&`, `%`, `$`, `_`, etc.) are correctly escaped (e.g. `\&`, `\%`, `\$`, `\_`) in the generated output to prevent compilation errors.
