# Pairwise separability

from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn import tree


from sklearn.model_selection import StratifiedKFold

from sklearn.model_selection import train_test_split, cross_val_score

X = metric.drop(['value'], axis=1)
y = metric['value']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

lda = LinearDiscriminantAnalysis()
rf = RandomForestClassifier(max_depth=10, random_state=0)
lg = LogisticRegression()
svm = SVC()
gbc = GradientBoostingClassifier()
knn = KNeighborsClassifier(n_neighbors=40,metric='euclidean')
dt = tree.DecisionTreeClassifier()

clf = lda
clf.fit(X_train, y_train)

cv_scores = cross_val_score(clf, X, y, cv=5)

print("Average cross-validation score (separability):", cv_scores.mean())

for class1 in range(1, 8):
  for class2 in range(class1 + 1, 9):
    X_subset = X[(y == class1) | (y == class2)]
    y_subset = y[(y == class1) | (y == class2)]

    cv_scores_subset = cross_val_score(clf, X_subset, y_subset, cv=5)
    print(f"Separability between class {class1} and class {class2}:", cv_scores_subset.mean())
