import ExpoModulesCore

public class ExpoTvosSearchModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ExpoTvosSearch")

        View(ExpoTvosSearchView.self) {
            Events("onSearch", "onSelectItem")

            Prop("results") { (view: ExpoTvosSearchView, results: [[String: Any]]) in
                view.updateResults(results)
            }

            Prop("columns") { (view: ExpoTvosSearchView, columns: Int) in
                view.columns = columns
            }

            Prop("placeholder") { (view: ExpoTvosSearchView, placeholder: String) in
                view.placeholder = placeholder
            }
        }
    }
}
